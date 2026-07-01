import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertDocument, ConvertError } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

// Convert an accepted Quotation into a Sales Order (D2 convert chain).
async function POST_handler(request: NextRequest) {
  try {
    const { quotationId } = await request.json();
    if (!quotationId) return NextResponse.json({ error: "quotationId is required" }, { status: 400 });
    const result = await convertDocument({ fromType: "quotation", fromId: quotationId, toType: "salesOrder" });
    const userId = request.headers.get("x-user-id") || "system";
    track("sales_order_created");
    logAudit({ userId, entity: "SalesOrder", entityId: result.id, action: "CREATE", after: { salesOrderNo: result.number, from: "quotation" } });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/sales-orders/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
