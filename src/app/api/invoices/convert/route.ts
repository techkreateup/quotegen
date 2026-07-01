import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertDocument, ConvertError, type ConvertableType } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

const SOURCES = new Set<ConvertableType>(["quotation", "salesOrder", "deliveryChallan"]);

// Convert a Quotation / Sales Order / Delivery Challan into a tax Invoice.
async function POST_handler(request: NextRequest) {
  try {
    const { fromType, fromId } = await request.json();
    if (!fromId || !SOURCES.has(fromType)) {
      return NextResponse.json({ error: "Valid fromType and fromId are required" }, { status: 400 });
    }
    const result = await convertDocument({ fromType, fromId, toType: "invoice" });
    const userId = request.headers.get("x-user-id") || "system";
    track("invoice_created");
    logAudit({ userId, entity: "Invoice", entityId: result.id, action: "CREATE", after: { invoiceNo: result.number, from: fromType } });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/invoices/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
