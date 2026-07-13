import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parseGstr2b, reconcile2b, type BookBill } from "@/lib/gstr2b";

// POST { json, from?, to? } — json is the GSTR-2B portal download (string or
// object). Reconciles its B2B section against recorded purchase bills in the
// same window (defaults to the 2B return period being unbounded → all bills).
async function POST_handler(request: NextRequest) {
  try {
    const body = await request.json();
    let parsed: unknown = body.json;
    if (typeof parsed === "string") {
      if (parsed.length > 5_000_000) return NextResponse.json({ error: "File too large (5 MB max)" }, { status: 413 });
      try { parsed = JSON.parse(parsed); } catch { return NextResponse.json({ error: "Not valid JSON — upload the GSTR-2B file downloaded from the GST portal" }, { status: 422 }); }
    }
    const docs = parseGstr2b(parsed);
    if (docs.length === 0) {
      return NextResponse.json({ error: "No B2B invoices found in this file — is it a GSTR-2B JSON?" }, { status: 422 });
    }

    const where: Record<string, unknown> = { deletedAt: null };
    const from = body.from ? new Date(body.from) : null;
    const to = body.to ? new Date(body.to) : null;
    if (from && !isNaN(+from) && to && !isNaN(+to)) {
      to.setHours(23, 59, 59, 999);
      where.billDate = { gte: from, lte: to };
    }
    const rows = await prisma.purchaseBill.findMany({
      where: where as never,
      select: { id: true, billNo: true, subtotal: true, totalAmount: true, vendor: { select: { name: true, gstin: true } } },
    });
    const bills: BookBill[] = rows.map((b) => ({
      id: b.id, billNo: b.billNo, vendorName: b.vendor.name, vendorGstin: b.vendor.gstin ?? "",
      totalAmount: b.totalAmount, subtotal: b.subtotal,
    }));

    const lines = reconcile2b(docs, bills);
    const counts = lines.reduce<Record<string, number>>((m, l) => ((m[l.status] = (m[l.status] ?? 0) + 1), m), {});
    return NextResponse.json({ lines, counts, b2bDocs: docs.length, bills: bills.length });
  } catch (err) {
    console.error("POST /api/gst-report/reconcile-2b error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
