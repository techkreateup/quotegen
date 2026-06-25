import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// GET /api/admin/webhooks/:id — full event row including payload JSON.
async function GET_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const platformRole = request.headers.get("x-platform-role");
  if (platformRole !== "SUPER_ADMIN" && platformRole !== "SUPPORT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const event = await prismaUnscoped.webhookEvent.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
