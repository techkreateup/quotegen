import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertPoToGrn, ConvertError } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

// Receive a Purchase Order's goods → creates a Goods Receipt Note.
async function POST_handler(request: NextRequest) {
  try {
    const { purchaseOrderId } = await request.json();
    if (!purchaseOrderId) return NextResponse.json({ error: "purchaseOrderId is required" }, { status: 400 });
    const grn = await convertPoToGrn(purchaseOrderId);
    const userId = request.headers.get("x-user-id") || "system";
    track("goods_receipt_created");
    logAudit({ userId, entity: "GoodsReceiptNote", entityId: grn.id, action: "CREATE", after: { grnNo: grn.grnNo, from: "purchaseOrder" } });
    return NextResponse.json(grn, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/goods-receipts/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
