import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, deliveryChallanSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { checkAndTriggerWorkflow } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, client: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapRow = (c: { client: { businessName: string }; challanDate: Date; [key: string]: unknown }) => ({
      ...c,
      clientName: c.client.businessName,
      challanDate: c.challanDate.toISOString().split("T")[0],
    });

    if (!pageParam) {
      const rows = await prisma.deliveryChallan.findMany({ include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(rows.map(mapRow));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.deliveryChallan.findMany({ include: includeOpts, orderBy: orderOpts, skip, take: limit }),
      prisma.deliveryChallan.count(),
    ]);

    return NextResponse.json({ data: rows.map(mapRow), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    console.error("GET /api/delivery-challans error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(deliveryChallanSchema, data);
    if (!v.ok) return v.response!;
    const { items, clientName, ...dcData } = data;

    const companyId = requireCompanyId();
    dcData.challanDate = dcData.challanDate ? new Date(dcData.challanDate) : new Date();
    if (!dcData.salesOrderId) delete dcData.salesOrderId;

    const dc = await prisma.$transaction(async (tx) => {
      if (!dcData.challanNo) {
        dcData.challanNo = (await nextDocNumber(tx, "nextChallanNo")).formatted;
      }
      return tx.deliveryChallan.create({
        data: { companyId, ...dcData, items: { create: sanitizeLineItems(items) } },
        include: { items: true },
      });
    });

    const userId = request.headers.get("x-user-id") || "system";
    const userRoleId = request.headers.get("x-user-role-id") || "";
    const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";
    if (!isSystemAdmin && userRoleId) {
      // DeliveryChallan has no PendingApproval status, so the workflow just gates
      // downstream conversion via the approvals engine; we don't remap status here.
      await checkAndTriggerWorkflow({ module: "delivery-challans", trigger: "create", entityId: dc.id, entityType: "delivery-challans", userId, userRoleId });
    }
    track("delivery_challan_created");
    logAudit({ userId, entity: "DeliveryChallan", entityId: dc.id, action: "CREATE", after: { challanNo: dc.challanNo, totalAmount: dc.totalAmount, status: dc.status } });
    return NextResponse.json(dc, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/delivery-challans error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
