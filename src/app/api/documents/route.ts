import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaUnscoped } from "@/lib/db";
import {
  companyStorageBytes,
  companyQuotaBytes,
  storageOverview,
} from "@/lib/storage";

// Categories every company should have at least one document in. Drives the
// compliance completeness score on the vault.
const REQUIRED_CATEGORIES = ["Legal", "HR", "Compliance", "Tax", "Finance"];

// List the company's documents (auto-scoped) + current storage usage.
async function GET_handler(request: NextRequest) {
  const companyId = request.headers.get("x-company-id") || "";
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category");
  const q = sp.get("q")?.trim();
  const employeeId = sp.get("employeeId");

  const where: Record<string, unknown> = {};
  if (category && category !== "All") where.category = category;
  if (employeeId) where.employeeId = employeeId;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [documents, companyBytes, quotaBytes, overview, catGroups] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    companyStorageBytes(companyId),
    companyQuotaBytes(companyId),
    storageOverview(),
    prismaUnscoped.document.groupBy({ by: ["category"], where: { companyId }, _count: true }),
  ]);

  const present = new Set(catGroups.map((g) => g.category));
  const missing = REQUIRED_CATEGORIES.filter((c) => !present.has(c));
  const compliance = {
    score: Math.round(((REQUIRED_CATEGORIES.length - missing.length) / REQUIRED_CATEGORIES.length) * 100),
    present: REQUIRED_CATEGORIES.filter((c) => present.has(c)),
    missing,
  };

  return NextResponse.json({
    documents,
    storage: {
      // Per-company view. quotaBytes is null unless the super admin set an
      // explicit cap — otherwise the company just draws from the shared pool.
      companyBytes,
      quotaBytes,
      totalBytes: overview.totalCapacity,
    },
    compliance,
  });
}

export const GET = withApi(GET_handler);
