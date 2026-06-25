import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// GET /api/admin/webhooks?provider=razorpay&event=…&limit=100
// Returns recent inbound webhook events. Super-admin / support only.
async function GET_handler(request: NextRequest) {
  const platformRole = request.headers.get("x-platform-role");
  if (platformRole !== "SUPER_ADMIN" && platformRole !== "SUPPORT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || undefined;
  const event = url.searchParams.get("event") || undefined;
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const onlyFailed = url.searchParams.get("failed") === "1";

  const where: Record<string, unknown> = {};
  if (provider) where.provider = provider;
  if (event) where.event = event;
  if (onlyFailed) {
    where.OR = [{ signatureOk: false }, { error: { not: "" } }];
  }
  const events = await prismaUnscoped.webhookEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, provider: true, event: true, signatureOk: true, responseCode: true,
      orderId: true, paymentId: true, companyId: true, error: true, createdAt: true,
    },
  });
  return NextResponse.json({ events });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
