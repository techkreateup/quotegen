import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertPoToBill, ConvertError } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

// Convert a Purchase Order into a Vendor Bill (PurchaseBill).
async function POST_handler(request: NextRequest) {
  try {
    const { purchaseOrderId } = await request.json();
    if (!purchaseOrderId) return NextResponse.json({ error: "purchaseOrderId is required" }, { status: 400 });
    const bill = await convertPoToBill(purchaseOrderId);
    const userId = request.headers.get("x-user-id") || "system";
    track("purchase_bill_created");
    logAudit({ userId, entity: "PurchaseBill", entityId: bill.id, action: "CREATE", after: { billNo: bill.billNo, from: "purchaseOrder" } });
    return NextResponse.json(bill, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/purchase-bills/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
