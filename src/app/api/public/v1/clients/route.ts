import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { runWithTenant } from "@/lib/tenant-context";
import { resolveApiKey } from "@/lib/api-keys";
import { rateLimit } from "@/lib/rate-limit";
import { checkFeatureAccess } from "@/lib/plan-limits";

// GET /api/public/v1/clients
// Public REST endpoint authenticated by an API key:
//   Authorization: Bearer qg_live_xxx
// Returns the company's clients (tenant-scoped via the resolved key).
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const resolved = await resolveApiKey(raw);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  if (!(await rateLimit(`apikey:${resolved.companyId}`, 120, 60_000))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!(await checkFeatureAccess(resolved.companyId, "api-access"))) {
    return NextResponse.json({ error: "API Access is not included in your plan" }, { status: 403 });
  }

  return runWithTenant({ companyId: resolved.companyId, userId: null }, async () => {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, businessName: true, email: true, gstin: true, city: true, state: true, createdAt: true },
    });
    return NextResponse.json({ data: clients });
  });
}
