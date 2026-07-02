import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaUnscoped } from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { track } from "@/lib/usage";

async function GET_handler() {
  const companyId = requireCompanyId();
  const [progress, clients, quotations, users, invoices, receipts, settings, employees, vendors] = await Promise.all([
    prismaUnscoped.onboardingProgress.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    }),
    prisma.client.count(),
    prisma.quotation.count(),
    prismaUnscoped.user.count({ where: { companyId } }),
    prisma.invoice.count(),
    prisma.paymentReceipt.count(),
    prisma.companySettings.findFirst({ select: { setupCompleted: true, logoUrl: true, businessName: true } }),
    prisma.employee.count(),
    prisma.vendor.count(),
  ]);
  return NextResponse.json({
    progress,
    checklist: {
      hasClient: clients > 0,
      hasQuotation: quotations > 0,
      hasTeamMember: users > 1,
      // Extended (adaptive dashboard) — E-polish
      setupCompleted: !!settings?.setupCompleted,
      hasBranding: !!(settings?.businessName && settings?.logoUrl),
      hasInvoice: invoices > 0,
      hasPayment: receipts > 0,
      hasEmployee: employees > 0,
      hasVendor: vendors > 0,
    },
  });
}

async function PUT_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.currentStep === "number") data.currentStep = body.currentStep;
  if (body.steps && typeof body.steps === "object") data.steps = body.steps;
  if (body.skipped === true) data.skippedAt = new Date();
  if (body.completed === true) data.completedAt = new Date();

  const progress = await prismaUnscoped.onboardingProgress.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...data },
  });

  if (body.completed === true) {
    await prismaUnscoped.company.update({
      where: { id: companyId },
      data: { onboardingCompletedAt: new Date() },
    });
    track("onboarding_completed");
  }
  if (body.skipped === true) track("onboarding_skipped");

  return NextResponse.json({ progress });
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
