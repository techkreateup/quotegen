import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { convertBillToDebitNote, ConvertError } from "@/lib/convert";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";

// Raise a Debit Note from a Vendor Bill (short supply / rate variance / return).
async function POST_handler(request: NextRequest) {
  try {
    const { purchaseBillId, reason } = await request.json();
    if (!purchaseBillId) return NextResponse.json({ error: "purchaseBillId is required" }, { status: 400 });
    const dn = await convertBillToDebitNote(purchaseBillId, reason);
    const userId = request.headers.get("x-user-id") || "system";
    track("debit_note_created");
    logAudit({ userId, entity: "DebitNote", entityId: dn.id, action: "CREATE", after: { debitNoteNo: dn.debitNoteNo, from: "purchaseBill" } });
    return NextResponse.json(dn, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ConvertError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/debit-notes/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
