import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, purchaseOrderSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { checkAndTriggerWorkflow } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, vendor: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapRow = (o: { vendor: { name: string }; orderDate: Date; expectedDate: Date | null; [key: string]: unknown }) => ({
      ...o,
      vendorName: o.vendor.name,
      orderDate: o.orderDate.toISOString().split("T")[0],
      expectedDate: o.expectedDate?.toISOString().split("T")[0] || "",
    });

    const active = { deletedAt: null };
    if (!pageParam) {
      const rows = await prisma.purchaseOrder.findMany({ where: active, include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(rows.map(mapRow));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where: active, include: includeOpts, orderBy: orderOpts, skip, take: limit }),
      prisma.purchaseOrder.count({ where: active }),
    ]);

    return NextResponse.json({ data: rows.map(mapRow), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    console.error("GET /api/purchase-orders error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That PO number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(purchaseOrderSchema, data);
    if (!v.ok) return v.response!;
    const { items, vendorName, ...poData } = data;

    const companyId = requireCompanyId();
    poData.orderDate = poData.orderDate ? new Date(poData.orderDate) : new Date();
    if (poData.expectedDate) poData.expectedDate = new Date(poData.expectedDate); else delete poData.expectedDate;

    const po = await prisma.$transaction(async (tx) => {
      if (!poData.purchaseOrderNo) {
        poData.purchaseOrderNo = (await nextDocNumber(tx, "nextPoNo")).formatted;
      }
      return tx.purchaseOrder.create({
        data: { companyId, ...poData, items: { create: sanitizeLineItems(items) } },
        include: { items: true },
      });
    });

    const userId = request.headers.get("x-user-id") || "system";
    const userRoleId = request.headers.get("x-user-role-id") || "";
    const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";
    if (!isSystemAdmin && userRoleId) {
      const wf = await checkAndTriggerWorkflow({ module: "purchase-orders", trigger: "create", entityId: po.id, entityType: "purchase-orders", userId, userRoleId });
      if (wf.triggered) await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "PendingApproval" } });
    }
    track("purchase_order_created");
    logAudit({ userId, entity: "PurchaseOrder", entityId: po.id, action: "CREATE", after: { purchaseOrderNo: po.purchaseOrderNo, totalAmount: po.totalAmount, status: po.status } });
    return NextResponse.json(po, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/purchase-orders error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That PO number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
