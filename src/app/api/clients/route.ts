import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import { track } from "@/lib/usage";
import { parse, clientSchema } from "@/lib/schemas";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    // If no page param, return full array for backward compatibility
    if (!pageParam) {
      const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
      return NextResponse.json(clients);
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.client.findMany({ orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.client.count(),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/clients error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(clientSchema, data);
    if (!v.ok) return v.response!;
    // Remove any relation/computed fields that Prisma would reject
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.quotations;
    delete data.invoices;
    delete data.receipts;
    delete data.projects;

    const client = await prisma.client.create({ data });
    track("client_created");
    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Client", entityId: client.id, action: "CREATE", after: { businessName: client.businessName, email: client.email, status: client.status } });
    logActivity({ entityType: "Client", entityId: client.id, action: "created", description: `Client "${client.businessName}" was created`, userId });
    return NextResponse.json(client, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/clients error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
