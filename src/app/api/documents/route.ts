import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  companyStorageBytes,
  globalStorageBytes,
  STORAGE_LIMIT_BYTES,
  STORAGE_SAFETY_BYTES,
} from "@/lib/storage";

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

  const [documents, companyBytes, globalBytes] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    companyStorageBytes(companyId),
    globalStorageBytes(),
  ]);

  return NextResponse.json({
    documents,
    storage: {
      companyBytes,
      globalBytes,
      limitBytes: STORAGE_LIMIT_BYTES,
      safetyBytes: STORAGE_SAFETY_BYTES,
    },
  });
}

export const GET = withApi(GET_handler);
