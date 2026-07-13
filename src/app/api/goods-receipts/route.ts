import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, goodsReceiptSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { checkAndTriggerWorkflow } from "@/lib/workflow";
import { postStockMovements } from "@/lib/stock";

// GRN line items carry orderedQty/rejectedQty on top of the shared shape.
function grnItems(items: unknown): Record<string, unknown>[] {
  return sanitizeLineItems(items).map((it, i) => {
    const raw = (Array.isArray(items) ? items[i] : {}) as Record<string, unknown>;
    return {
      ...it,
      orderedQty: raw.orderedQty != null ? raw.orderedQty : it.quantity,
      rejectedQty: raw.rejectedQty != null ? raw.rejectedQty : 0,
    };
  });
}

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");
    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, vendor: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapRow = (g: { vendor: { name: string }; receiptDate: Date; [key: string]: unknown }) => ({
      ...g,
      vendorName: g.vendor.name,
      receiptDate: g.receiptDate.toISOString().split("T")[0],
    });

    const active = { deletedAt: null };
    if (!pageParam) {
      const rows = await prisma.goodsReceiptNote.findMany({ where: active, include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(rows.map(mapRow));
    }
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const [rows, total] = await Promise.all([
      prisma.goodsReceiptNote.findMany({ where: active, include: includeOpts, orderBy: orderOpts, skip: (page - 1) * limit, take: limit }),
      prisma.goodsReceiptNote.count({ where: active }),
    ]);
    return NextResponse.json({ data: rows.map(mapRow), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    console.error("GET /api/goods-receipts error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That GRN number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(goodsReceiptSchema, data);
    if (!v.ok) return v.response!;
    const { items, vendorName, ...grnData } = data;

    const companyId = requireCompanyId();
    grnData.receiptDate = grnData.receiptDate ? new Date(grnData.receiptDate) : new Date();
    if (!grnData.purchaseOrderId) delete grnData.purchaseOrderId;

    const grn = await prisma.$transaction(async (tx) => {
      if (!grnData.grnNo) grnData.grnNo = (await nextDocNumber(tx, "nextGrnNo")).formatted;
      const created = await tx.goodsReceiptNote.create({
        data: { companyId, ...grnData, items: { create: grnItems(items) } },
        include: { items: true },
      });
      await postStockMovements(tx, {
        companyId, kind: "grn_in", refType: "GoodsReceiptNote",
        refId: created.id, refNo: created.grnNo,
        lines: created.items.map((it) => ({ itemName: it.itemName, quantity: it.quantity })),
        direction: 1,
      });
      return created;
    });

    const userId = request.headers.get("x-user-id") || "system";
    const userRoleId = request.headers.get("x-user-role-id") || "";
    const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";
    if (!isSystemAdmin && userRoleId) {
      // GRN has no PendingApproval status â€” approval simply gates downstream conversion.
      await checkAndTriggerWorkflow({ module: "goods-receipts", trigger: "create", entityId: grn.id, entityType: "goods-receipts", userId, userRoleId });
    }
    track("goods_receipt_created");
    logAudit({ userId, entity: "GoodsReceiptNote", entityId: grn.id, action: "CREATE", after: { grnNo: grn.grnNo, status: grn.status } });
    return NextResponse.json(grn, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/goods-receipts error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That GRN number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
