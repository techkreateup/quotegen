import { withApi, invalidateCompanyCache } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { invalidateFeatureCache } from "@/lib/feature-gate";
import { getPlanDef } from "@/lib/plans-db";
import { transitionSubscription, canTransition } from "@/lib/subscription";
import { periodEnd } from "@/lib/proration";
import {
  resolveFeatures,
  PLANS,
  FEATURE_KEYS,
  type FeatureMap,
  type Plan,
} from "@/lib/features";
import type { SubscriptionStatus } from "@prisma/client";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prismaUnscoped.company.findUnique({
    where: { id },
    include: {
      settings: { select: { businessName: true, email: true, phones: true, city: true, state: true, country: true } },
      users: {
        select: { id: true, name: true, email: true, platformRole: true, isActive: true, lastLoginAt: true, userRole: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      onboarding: true,
      _count: { select: { clients: true, quotations: true, invoices: true, receipts: true, employees: true, issues: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const recentEvents = await prismaUnscoped.usageEvent.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const payments = await prismaUnscoped.billingPayment.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      planName: true,
      razorpayPaymentId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    company: {
      ...company,
      features: resolveFeatures(company.featureOverrides as FeatureMap),
    },
    recentEvents,
    payments,
  });
}

async function PATCH_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const userId = request.headers.get("x-user-id") || "system";

  const existing = await prismaUnscoped.company.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  let action = "UPDATE";

  // Enable / disable
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
    data.suspendedReason = body.isActive ? null : (body.suspendedReason ?? "Disabled by platform admin");
    action = body.isActive ? "ENABLE" : "DISABLE";
  }

  // Plan change
  if (typeof body.plan === "string") {
    if (!PLANS.includes(body.plan as Plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    data.plan = body.plan;
    // Optionally re-seed feature overrides + seat limit from the (live, editable)
    // plan template so super-admin plan customizations are honoured here too.
    if (body.applyPlanFeatures) {
      const def = await getPlanDef(body.plan as Plan);
      const enabled = new Set(def?.features ?? []);
      data.featureOverrides = Object.fromEntries(FEATURE_KEYS.map((k) => [k, enabled.has(k)]));
      data.maxUsers = def?.maxUsers ?? null;
      action = "PLAN_CHANGE";
    }
  }

  // Seat limit
  if (body.maxUsers !== undefined) {
    const n = body.maxUsers === null ? null : Number(body.maxUsers);
    if (n !== null && (!Number.isFinite(n) || n < 1)) {
      return NextResponse.json({ error: "maxUsers must be a positive number or null" }, { status: 400 });
    }
    data.maxUsers = n;
  }

  // Admin notes
  if (typeof body.adminNotes === "string") data.adminNotes = body.adminNotes;

  // Feature override(s): partial merge of { key: boolean }
  if (body.featureOverrides && typeof body.featureOverrides === "object") {
    const current = (existing.featureOverrides as FeatureMap) ?? {};
    const merged: FeatureMap = { ...current };
    for (const [k, v] of Object.entries(body.featureOverrides)) {
      if (FEATURE_KEYS.includes(k) && typeof v === "boolean") merged[k] = v;
    }
    data.featureOverrides = merged;
    action = action === "UPDATE" ? "FEATURE_CHANGE" : action;
  }

  // Trial extension: extend trialEndsAt by N days (or set to an absolute date).
  // Only meaningful while the company is TRIALING; for other states it just
  // updates the field for record-keeping.
  if (body.extendTrialDays !== undefined) {
    const n = Number(body.extendTrialDays);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return NextResponse.json({ error: "extendTrialDays must be 1–365" }, { status: 400 });
    }
    const base = existing.trialEndsAt && existing.trialEndsAt > new Date() ? existing.trialEndsAt : new Date();
    data.trialEndsAt = new Date(base.getTime() + n * 86_400_000);
    action = "TRIAL_EXTENDED";
  }

  // Manual subscription activation: comp a paid plan to a customer without a
  // Razorpay charge. Validates the transition, sets ACTIVE + opens a billing
  // window of `compMonths` (default 1) using the plan's billing cadence.
  let manualActivationResult: { from: string; to: string; periodEnd: Date | null } | null = null;
  if (typeof body.manualActivatePlan === "string") {
    if (!PLANS.includes(body.manualActivatePlan as Plan)) {
      return NextResponse.json({ error: "Invalid plan for manual activation" }, { status: 400 });
    }
    const compMonths = Math.max(1, Math.min(36, Number(body.compMonths) || 1));
    const planDef = await getPlanDef(body.manualActivatePlan as Plan);
    const from = existing.subscriptionStatus;
    if (!canTransition(from as SubscriptionStatus, "ACTIVE")) {
      return NextResponse.json(
        { error: `Cannot move ${from} → ACTIVE. Cancel first if currently ACTIVE.` },
        { status: 400 },
      );
    }
    await transitionSubscription(id, "ACTIVE", { planId: body.manualActivatePlan });
    const start = new Date();
    // Yearly plans get one year per "compMonth × 12" call would be confusing — keep
    // explicit: compMonths is months, regardless of plan cadence.
    const end = new Date(start);
    end.setMonth(end.getMonth() + compMonths);
    await prismaUnscoped.company.update({
      where: { id },
      data: { currentPeriodStart: start, currentPeriodEnd: end, plan: body.manualActivatePlan },
    });
    manualActivationResult = { from, to: "ACTIVE", periodEnd: end };
    action = "MANUAL_ACTIVATION";
    // Don't fall through to a generic update for this — we already applied changes.
    if (Object.keys(data).length === 0) {
      logAudit({
        userId, entity: "Company", entityId: id, action,
        before: { subscriptionStatus: from, plan: existing.plan },
        after: { subscriptionStatus: "ACTIVE", plan: body.manualActivatePlan, periodEnd: end, compMonths },
      });
      invalidateCompanyCache(id);
      // Use a separate side-effect var to avoid TS narrowing churn.
      const refreshed = await prismaUnscoped.company.findUnique({ where: { id } });
      return NextResponse.json({
        company: { ...refreshed, features: resolveFeatures((refreshed?.featureOverrides as FeatureMap) ?? {}) },
        manualActivation: manualActivationResult,
      });
    }
    // suppress periodEnd unused warning when not in the trivial path
    void periodEnd;
    void planDef;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const company = await prismaUnscoped.company.update({ where: { id }, data });
  invalidateCompanyCache(id);
  invalidateFeatureCache(id);

  logAudit({
    userId,
    entity: "Company",
    entityId: id,
    action,
    before: { plan: existing.plan, isActive: existing.isActive, maxUsers: existing.maxUsers, featureOverrides: existing.featureOverrides },
    after: { plan: company.plan, isActive: company.isActive, maxUsers: company.maxUsers, featureOverrides: company.featureOverrides },
  });

  return NextResponse.json({
    company: { ...company, features: resolveFeatures(company.featureOverrides as FeatureMap) },
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PATCH = withApi(PATCH_handler, { allowPlatform: true });
