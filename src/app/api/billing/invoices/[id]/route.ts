import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/billing/invoices/:id — printable HTML GST invoice (downloadable).
async function GET_handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const inv = await prisma.subscriptionInvoice.findUnique({ where: { id } });
  // findUnique is tenant-scoped, so a foreign invoice resolves to null.
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const settings = await prisma.companySettings.findFirst();
  const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  // Escape any user-controlled value before interpolating into HTML (businessName,
  // GSTIN, place of supply are tenant-editable) to prevent stored XSS.
  const esc = (s: string | null | undefined) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
    );
  const taxRows = inv.igst > 0
    ? `<tr><td>IGST (18%)</td><td style="text-align:right">${inr(inv.igst)}</td></tr>`
    : `<tr><td>CGST (9%)</td><td style="text-align:right">${inr(inv.cgst)}</td></tr>
       <tr><td>SGST (9%)</td><td style="text-align:right">${inr(inv.sgst)}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(inv.invoiceNumber)}</title>
  <style>body{font-family:sans-serif;max-width:720px;margin:32px auto;color:#1f2937}
  h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
  td,th{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px}
  .tot{font-weight:700}</style></head><body>
  <h1>Tax Invoice</h1>
  <p><strong>${esc(inv.invoiceNumber)}</strong> · ${new Date(inv.createdAt).toLocaleDateString("en-IN")}</p>
  <p>Billed to: ${esc(settings?.businessName || "Customer")}<br/>
  GSTIN: ${esc(inv.customerGstin || "—")} · Place of supply: ${esc(inv.placeOfSupply || "—")}</p>
  <table>
    <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
    <tr><td>QuoteGen subscription (SAC ${esc(inv.sacCode)})</td><td style="text-align:right">${inr(inv.taxableValue)}</td></tr>
    ${taxRows}
    <tr class="tot"><td>Total</td><td style="text-align:right">${inr(inv.total)}</td></tr>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">This is a computer-generated invoice.</p>
  </body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const GET = withApi(GET_handler);
