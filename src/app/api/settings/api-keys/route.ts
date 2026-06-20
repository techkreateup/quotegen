import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateApiKey } from "@/lib/api-keys";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";
import { checkFeatureAccess } from "@/lib/plan-limits";

// GET /api/settings/api-keys — list this company's keys (never returns the raw key).
async function GET_handler() {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json(keys);
}

// POST /api/settings/api-keys { name } — create a key; raw value returned ONCE.
async function POST_handler(request: NextRequest) {
  if (!(await checkFeatureAccess(requireCompanyId(), "api-access"))) {
    return NextResponse.json({ error: "API Access is not included in your plan" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { raw, keyHash, keyPrefix } = generateApiKey();

  const key = await prisma.apiKey.create({
    data: { companyId: requireCompanyId(), name: String(body.name || "API key").slice(0, 80), keyHash, keyPrefix },
  });

  const userId = request.headers.get("x-user-id") || "system";
  logAudit({ userId, entity: "ApiKey", entityId: key.id, action: "CREATE", after: { name: key.name } });

  // The raw key is shown only here, never stored in plaintext.
  return NextResponse.json({ id: key.id, name: key.name, key: raw }, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
