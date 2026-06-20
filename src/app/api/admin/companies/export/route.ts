import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toCSV, csvDownloadHeaders } from "@/lib/csv";
import { enabledFeatureCount, type FeatureMap } from "@/lib/features";

// Full company directory export (CSV) for verification / compliance. Includes
// business identity (GSTIN, PAN), address, contact, bank, plan, limits, the
// primary admin, and document counts. SUPER_ADMIN only (gated by proxy).
async function GET_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status") || "";
  const plan = url.searchParams.get("plan") || "";

  const where: Record<string, unknown> = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;
  if (plan) where.plan = plan;

  const companies = await prismaUnscoped.company.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      settings: true,
      _count: { select: { users: true, clients: true, invoices: true, quotations: true, receipts: true } },
      users: {
        where: { platformRole: "COMPANY_ADMIN" },
        select: { name: true, email: true, lastLoginAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const headers = [
    "Company ID", "Name", "Slug", "Plan", "Status", "Seat limit", "Features on",
    "Created", "Onboarded",
    "Business name", "GSTIN", "PAN", "Email", "Phone",
    "Address", "City", "State", "Pincode", "Country",
    "Bank name", "Account name", "Account number", "IFSC",
    "Admin name", "Admin email", "Admin last login",
    "Users", "Clients", "Quotations", "Invoices", "Receipts",
  ];

  const rows = companies.map((c) => {
    const s = c.settings;
    const admin = c.users[0];
    return [
      c.id, c.name, c.slug, c.plan, c.isActive ? "Active" : "Disabled",
      c.maxUsers ?? "Unlimited", enabledFeatureCount(c.featureOverrides as FeatureMap),
      c.createdAt.toISOString().slice(0, 10),
      c.onboardingCompletedAt ? c.onboardingCompletedAt.toISOString().slice(0, 10) : "No",
      s?.businessName ?? "", s?.gstin ?? "", s?.pan ?? "", s?.email ?? "", (s?.phones ?? []).join(" / "),
      s?.address ?? "", s?.city ?? "", s?.state ?? "", s?.pincode ?? "", s?.country ?? "",
      s?.bankName ?? "", s?.accountName ?? "", s?.accountNumber ?? "", s?.ifsc ?? "",
      admin?.name ?? "", admin?.email ?? "", admin?.lastLoginAt ? admin.lastLoginAt.toISOString().slice(0, 10) : "never",
      c._count.users, c._count.clients, c._count.quotations, c._count.invoices, c._count.receipts,
    ];
  });

  logAudit({ userId: adminId, entity: "Company", entityId: "export", action: "EXPORT_COMPANIES", after: { count: companies.length } });

  const csv = toCSV(headers, rows);
  return new NextResponse(csv, { headers: csvDownloadHeaders(`quotegen-companies-${new Date().toISOString().slice(0, 10)}.csv`) });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
