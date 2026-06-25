// Anthropic-style A4 invoice / receipt template, used by /api/billing/invoices/[id]
// (variant: "invoice") and /api/billing/invoices/[id]/receipt (variant: "receipt").
//
// All user-controlled values MUST be passed through `esc()` before interpolation —
// businessName, GSTIN, address, brand fields are tenant- or admin-editable.

import type { PlatformBrand, PlatformGstConfig } from "@/lib/platform-brand";

export type DocVariant = "invoice" | "receipt";

export interface InvoiceData {
  invoiceNumber: string;
  createdAt: Date;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  customerGstin: string;
  placeOfSupply: string;
  sacCode: string;
}

export interface PaymentData {
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number; // paise
  currency: string;
  planName: string | null;
  createdAt: Date;
  paymentMethod?: string | null; // optional, from Razorpay (we don't store it; usually null)
}

export interface CustomerData {
  businessName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
}

export interface RenderArgs {
  variant: DocVariant;
  brand: PlatformBrand;
  gst: PlatformGstConfig;
  invoice: InvoiceData;
  payment: PaymentData;
  customer: CustomerData;
}

export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

const periodLabel = (planName: string | null | undefined, createdAt: Date) => {
  // Simple "Month D – Month D+30, YYYY" range for visual continuity; subscription
  // periods are tracked separately on the Company row.
  const start = createdAt;
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const startFmt = start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const endFmt = end.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${esc(planName ?? "Subscription")} · ${startFmt} – ${endFmt}`;
};

function addressBlock(lines: Array<string | null | undefined>) {
  return lines
    .map((l) => (l ?? "").trim())
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");
}

export function renderBillingDoc(args: RenderArgs): string {
  const { variant, brand, gst, invoice, payment, customer } = args;
  const isReceipt = variant === "receipt";

  const docTitle = isReceipt ? "Receipt" : "Tax Invoice";
  const amountLineLabel = isReceipt
    ? `${inr(invoice.total)} paid on ${fmtDate(payment.createdAt)}`
    : `${inr(invoice.total)} due ${fmtDate(payment.createdAt)}`;
  const totalsLabel = isReceipt ? "Amount paid" : "Amount due";

  const intraState = invoice.cgst > 0;
  const gstPct = Math.round(gst.rate * 1000) / 10;

  // Address blocks
  const fromAddress = addressBlock([
    brand.address,
  ]);
  const billToCityLine = [customer.city, customer.state, customer.pincode]
    .map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
  const billToAddress = addressBlock([
    customer.address,
    billToCityLine,
    customer.country,
  ]);

  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" style="max-height:38px;max-width:160px;object-fit:contain"/>`
    : `<div style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">${esc(brand.name)}</div>`;

  const metaRow = (label: string, value: string) => `
    <tr>
      <td style="padding:3px 18px 3px 0;color:#475569;font-weight:600;white-space:nowrap;vertical-align:top">${esc(label)}</td>
      <td style="padding:3px 0;color:#0f172a;vertical-align:top">${value}</td>
    </tr>`;

  const taxRows = intraState
    ? `<tr><td colspan="3" style="padding:6px 12px;color:#475569;text-align:right">CGST (${gstPct / 2}%)</td><td style="padding:6px 0;text-align:right;color:#0f172a">${inr(invoice.cgst)}</td></tr>
       <tr><td colspan="3" style="padding:6px 12px;color:#475569;text-align:right">SGST (${gstPct / 2}%)</td><td style="padding:6px 0;text-align:right;color:#0f172a">${inr(invoice.sgst)}</td></tr>`
    : `<tr><td colspan="3" style="padding:6px 12px;color:#475569;text-align:right">IGST (${gstPct}%)</td><td style="padding:6px 0;text-align:right;color:#0f172a">${inr(invoice.igst)}</td></tr>`;

  const paymentHistorySection = isReceipt
    ? `<div style="margin-top:42px">
        <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px">Payment history</h2>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid #e5e7eb">
              <th style="text-align:left;padding:8px 12px 8px 0;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Payment method</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Date</th>
              <th style="text-align:right;padding:8px 12px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Amount paid</th>
              <th style="text-align:right;padding:8px 0 8px 12px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Reference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:14px 12px 14px 0;color:#0f172a">${esc(payment.paymentMethod || "Razorpay")}</td>
              <td style="padding:14px 12px;color:#475569">${fmtDate(payment.createdAt)}</td>
              <td style="padding:14px 12px;color:#0f172a;text-align:right;font-weight:600">${inr(invoice.total)}</td>
              <td style="padding:14px 0 14px 12px;color:#475569;text-align:right;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px">${esc(payment.razorpayPaymentId || payment.razorpayOrderId)}</td>
            </tr>
          </tbody>
        </table>
      </div>`
    : "";

  const poweredBy = brand.poweredBy
    ? `<div style="text-align:right;font-size:11px;color:#94a3b8">Powered by <strong style="color:#475569">${esc(brand.poweredBy)}</strong></div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(docTitle)} — ${esc(invoice.invoiceNumber)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    max-width: 800px;
    margin: 24px auto;
    background: #fff;
    padding: 48px 56px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06);
  }
  .actions {
    max-width: 800px;
    margin: 16px auto 0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .actions button, .actions a {
    background: #4f46e5; color: #fff; border: 0; padding: 8px 16px;
    border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    text-decoration: none;
  }
  .actions .ghost { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
  @media print {
    body { background: #fff; }
    .actions, .no-print { display: none !important; }
    .page { box-shadow: none; margin: 0; padding: 0; max-width: none; border-radius: 0; }
  }
  h1 { font-size: 32px; font-weight: 800; margin: 0 0 28px; letter-spacing: -0.5px; color: #0f172a; }
  h2 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #0f172a; }
  table { border-collapse: collapse; }
  .amount-line {
    margin: 32px 0 8px;
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.25px;
  }
  .item-table {
    width: 100%;
    margin-top: 24px;
  }
  .item-table th {
    text-align: left;
    padding: 10px 12px 10px 0;
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e5e7eb;
  }
  .item-table td {
    padding: 14px 12px 14px 0;
    color: #0f172a;
    font-size: 13px;
    vertical-align: top;
  }
  .totals-table { margin-left: auto; margin-top: 4px; min-width: 280px; }
  .totals-table td { padding: 6px 0; font-size: 13px; }
  .totals-table .label { color: #475569; padding-right: 24px; text-align: right; }
  .totals-table .val { color: #0f172a; text-align: right; font-variant-numeric: tabular-nums; }
  .totals-table .grand .label { font-weight: 700; color: #0f172a; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  .totals-table .grand .val { font-weight: 700; color: #0f172a; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #94a3b8;
  }
  .col2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin: 12px 0 0;
    font-size: 13px;
  }
  .col2 .label { font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .col2 .body { color: #475569; }
  .col2 .body div { margin: 1px 0; }
</style>
</head>
<body>
<div class="actions">
  <button onclick="window.print()" class="ghost">Print / Save as PDF</button>
</div>
<div class="page">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:8px">
    <div style="flex:1;min-width:0">
      <h1>${esc(docTitle)}</h1>
      <table style="font-size:13px">
        ${metaRow("Invoice number", `<strong>${esc(invoice.invoiceNumber)}</strong>`)}
        ${isReceipt ? metaRow("Receipt number", `<span style="font-family:ui-monospace,'SF Mono',Menlo,monospace">${esc(payment.razorpayPaymentId || payment.razorpayOrderId)}</span>`) : ""}
        ${metaRow(isReceipt ? "Date paid" : "Date of issue", fmtDate(payment.createdAt))}
        ${gst.gstin ? metaRow("GSTIN", `<span style="font-family:ui-monospace,'SF Mono',Menlo,monospace">${esc(gst.gstin)}</span>`) : ""}
        ${metaRow("Place of supply", esc(invoice.placeOfSupply || customer.state || "—"))}
        ${metaRow("SAC code", esc(invoice.sacCode || "9983"))}
      </table>
    </div>
    <div style="flex-shrink:0">${logo}</div>
  </div>

  <!-- From / Bill to -->
  <div class="col2">
    <div>
      <div class="label">${esc(brand.legalName || brand.name)}</div>
      <div class="body">
        ${fromAddress}
        ${brand.email ? `<div>${esc(brand.email)}</div>` : ""}
        ${brand.phone ? `<div>${esc(brand.phone)}</div>` : ""}
        ${brand.website ? `<div>${esc(brand.website)}</div>` : ""}
      </div>
    </div>
    <div>
      <div class="label">Bill to</div>
      <div class="body">
        <div style="font-weight:600;color:#0f172a;margin-bottom:2px">${esc(customer.businessName)}</div>
        ${billToAddress}
        ${customer.email ? `<div>${esc(customer.email)}</div>` : ""}
        ${customer.gstin ? `<div style="margin-top:4px">GSTIN <span style="font-family:ui-monospace,'SF Mono',Menlo,monospace">${esc(customer.gstin)}</span></div>` : ""}
      </div>
    </div>
  </div>

  <!-- Amount line -->
  <div class="amount-line">${amountLineLabel}</div>

  <!-- Item table -->
  <table class="item-table">
    <thead>
      <tr>
        <th style="width:60%">Description</th>
        <th style="width:10%;text-align:right">Qty</th>
        <th style="width:15%;text-align:right">Unit price</th>
        <th style="width:15%;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td>
          <div style="font-weight:600">${esc(payment.planName || "Subscription")} plan</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:2px">${periodLabel(payment.planName, payment.createdAt)}</div>
        </td>
        <td style="text-align:right">1</td>
        <td style="text-align:right">${inr(invoice.taxableValue)}</td>
        <td style="text-align:right;font-weight:600">${inr(invoice.taxableValue)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <table class="totals-table">
    <tr>
      <td class="label">Subtotal</td>
      <td class="val">${inr(invoice.taxableValue)}</td>
    </tr>
    ${gst.rate > 0 ? (intraState
      ? `<tr><td class="label">CGST (${gstPct / 2}%)</td><td class="val">${inr(invoice.cgst)}</td></tr>
         <tr><td class="label">SGST (${gstPct / 2}%)</td><td class="val">${inr(invoice.sgst)}</td></tr>`
      : `<tr><td class="label">IGST (${gstPct}%)</td><td class="val">${inr(invoice.igst)}</td></tr>`
    ) : ""}
    <tr><td class="label">Total</td><td class="val">${inr(invoice.total)}</td></tr>
    <tr class="grand"><td class="label">${esc(totalsLabel)}</td><td class="val">${inr(invoice.total)}</td></tr>
  </table>

  ${paymentHistorySection}

  <!-- Footer -->
  <div class="footer">
    <div>This is a computer-generated ${esc(docTitle.toLowerCase())} and does not require a signature.</div>
    ${poweredBy}
  </div>
</div>
</body>
</html>`;
}
