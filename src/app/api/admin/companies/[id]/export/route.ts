import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { resolveFeatures, type FeatureMap } from "@/lib/features";

// Complete dossier for one company (JSON download) — full profile, settings,
// resolved features, and every user. For verification / KYC purposes.
async function GET_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = request.headers.get("x-user-id") || "system";

  const company = await prismaUnscoped.company.findUnique({
    where: { id },
    include: {
      settings: true,
      onboarding: true,
      users: {
        select: { id: true, name: true, email: true, platformRole: true, isActive: true, lastLoginAt: true, createdAt: true, userRole: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { clients: true, quotations: true, invoices: true, receipts: true, employees: true, vendors: true, issues: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const dossier = {
    exportedAt: new Date().toISOString(),
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      isActive: company.isActive,
      suspendedReason: company.suspendedReason,
      maxUsers: company.maxUsers,
      adminNotes: company.adminNotes,
      createdAt: company.createdAt,
      onboardingCompletedAt: company.onboardingCompletedAt,
    },
    features: resolveFeatures(company.featureOverrides as FeatureMap),
    settings: company.settings,
    counts: company._count,
    users: company.users.map((u) => ({ ...u, role: u.userRole?.name ?? u.platformRole })),
  };

  logAudit({ userId: adminId, entity: "Company", entityId: id, action: "EXPORT_COMPANY", after: { name: company.name, users: company.users.length } });

  const safeName = company.slug || company.id;
  return new NextResponse(JSON.stringify(dossier, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="company-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
