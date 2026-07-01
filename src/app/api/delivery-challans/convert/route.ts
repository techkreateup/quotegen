import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertDocument, ConvertError } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

// Convert a Sales Order into a Delivery Challan (goods movement).
async function POST_handler(request: NextRequest) {
  try {
    const { salesOrderId } = await request.json();
    if (!salesOrderId) return NextResponse.json({ error: "salesOrderId is required" }, { status: 400 });
    const result = await convertDocument({ fromType: "salesOrder", fromId: salesOrderId, toType: "deliveryChallan" });
    const userId = request.headers.get("x-user-id") || "system";
    track("delivery_challan_created");
    logAudit({ userId, entity: "DeliveryChallan", entityId: result.id, action: "CREATE", after: { challanNo: result.number, from: "salesOrder" } });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/delivery-challans/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
