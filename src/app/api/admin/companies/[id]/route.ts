import { withApi, invalidateCompanyCache } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { invalidateFeatureCache } from "@/lib/feature-gate";
import { getPlanDef } from "@/lib/plans-db";
import {
  resolveFeatures,
  PLANS,
  FEATURE_KEYS,
  type FeatureMap,
  type Plan,
} from "@/lib/features";

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
