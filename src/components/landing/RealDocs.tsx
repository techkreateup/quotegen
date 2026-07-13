"use client";

import { useState } from "react";
import DocumentPreview from "@/components/DocumentPreview";
import { DOC_TEMPLATES, renderDocument, type Brand } from "@/lib/doc-templates";
import type { CompanySettings, LineItem } from "@/lib/types";

const DEMO_BRAND: Brand = {
  name: "Example Studio", address: "1 Example Street, Example City 600001",
  website: "example.com", email: "billing@example.com", phone: "+91 90000 00000",
  gstin: "33ABCDE1234F1Z5", accent: "#4F46E5", showLogo: false,
};

/* Renders a REAL letter template through the app's renderDocument engine. */
export function LetterDoc({ tplId, values }: { tplId: string; values: Record<string, string> }) {
  const t = DOC_TEMPLATES.find((x) => x.id === tplId);
  if (!t) return null;
  const html = renderDocument(t, { signatory: "R. Priya", designation: "Director", ...values }, DEMO_BRAND);
  return (
    <div className="mx-auto rounded-xl overflow-x-auto" style={{ maxWidth: 820, border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)", background: "white" }}>
      <div style={{ minWidth: 640, background: "white", padding: 28 }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/* Real SaaS outputs for marketing surfaces. Rendered by the app's actual
   DocumentPreview engine with a sample company — pixel-identical to what
   paying customers generate. Shared by the /demo mirror and the doc gallery. */

export const DEMO_SETTINGS = {
  businessName: "Example Studio",
  address: "1 Example Street", city: "Coimbatore", state: "Tamil Nadu", country: "India", pincode: "641002",
  gstin: "33ABCDE1234F1Z5", pan: "ABCDE1234F",
  email: "billing@example.com", phones: ["+91 90000 00000"],
  bankName: "Example Bank", accountName: "Example Studio", accountNumber: "00000000000000", ifsc: "EXBK0000001", accountType: "Current",
  logoUrl: "", themeColor: "#4F46E5",
  contactFooter: "", documentFooter: "", website: "example.com",
} as unknown as CompanySettings;

export const DEMO_ITEMS = [
  { id: "1", itemName: "Monthly design retainer — July", description: "Dedicated design support, up to 60 hrs", hsnSac: "9983", gstRate: 18, quantity: 1, rate: 100000, discountType: "fixed", discountValue: 0, discountAmount: 0, amount: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000 },
] as unknown as LineItem[];

export type RealDocType = "Invoice" | "Quotation" | "Payment Receipt" | "Sales Order" | "Delivery Challan" | "Purchase Order" | "Debit Note" | "Goods Receipt Note";

export function RealDoc({ type, no, status, title, note }: { type: RealDocType; no: string; status: string; title: string; note?: string }) {
  return (
    <div className="mt-4">
      {note && <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>{note}</p>}
      <div className="mx-auto rounded-xl overflow-x-auto" style={{ maxWidth: 820, border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)", background: "white" }}>
        <div style={{ minWidth: 680, background: "white" }}>
          <DocumentPreview
            id={`realdoc-${type}-${no}`}
            type={type}
            documentNo={no}
            date="2026-07-04"
            dueDate={type === "Invoice" ? "2026-07-19" : undefined}
            title={title}
            status={status}
            settings={DEMO_SETTINGS}
            clientName={type === "Purchase Order" || type === "Debit Note" || type === "Goods Receipt Note" ? "Sample Prints" : "Sample Interiors"}
            clientAddress={type === "Purchase Order" || type === "Debit Note" || type === "Goods Receipt Note" ? "3 Sample Road, Example City 600002" : "2 Sample Road, Example City 600001"}
            clientEmail="accounts@example.com"
            clientGstin="33ABCDE1234F2Z6"
            items={DEMO_ITEMS}
            subtotal={100000}
            totalDiscount={0}
            totalCgst={9000}
            totalSgst={9000}
            totalIgst={0}
            totalAmount={118000}
            paymentMethod={type === "Payment Receipt" ? "UPI" : undefined}
            invoiceNo={type === "Payment Receipt" ? "INV-00248" : undefined}
            paymentDate={type === "Payment Receipt" ? "2026-07-04" : undefined}
            notes="Thank you for your business!"
          />
        </div>
      </div>
    </div>
  );
}

/* ── extra outputs (non-DocumentPreview engines) ───────────────────────── */
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/* REAL payslip — the app's actual "Salary Slip" template rendered by its engine */
export function PayslipDoc() {
  return <LetterDoc tplId="salary-slip" values={{ employee: "Arun Kumar", empId: "EMP-0004", month: "July 2026", gross: "47,230", deductions: "4,930", net: "42,300", date: "31 Jul 2026" }} />;
}

function PayslipDocOld() {
  return (
    <div className="mx-auto rounded-xl" style={{ maxWidth: 560, background: "white", border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)", padding: 20, fontSize: 12, color: "#0F172A" }}>
      <div className="flex justify-between pb-2" style={{ borderBottom: "2px solid #0F172A" }}>
        <p className="font-bold" style={{ color: "#4F46E5" }}>Example Studio</p>
        <p className="font-bold">Payslip · July 2026</p>
      </div>
      <div className="grid grid-cols-2 gap-2 py-2" style={{ color: "#475569" }}>
        <span>Arun Kumar · Sales Executive</span><span className="text-right">PF: XX/XXX/00000 · UAN: 100000000000</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold text-[10.5px] uppercase" style={{ color: "#94A3B8" }}>Earnings</p>
          {[["Basic", 22500], ["HRA", 9000], ["Special allowance", 15730]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-0.5"><span>{l}</span><span className="lp-num">{inr(v as number)}</span></div>
          ))}
        </div>
        <div>
          <p className="font-bold text-[10.5px] uppercase" style={{ color: "#94A3B8" }}>Deductions</p>
          {[["PF (12%)", 2700], ["Professional tax", 200], ["TDS", 2030]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-0.5"><span>{l}</span><span className="lp-num">{inr(v as number)}</span></div>
          ))}
        </div>
      </div>
      <div className="flex justify-between font-bold mt-2 pt-2 text-[13px]" style={{ borderTop: "1.5px solid #0F172A" }}>
        <span>Net Pay</span><span className="lp-num" style={{ color: "#059669" }}>{inr(42300)}</span>
      </div>
    </div>
  );
}

export function FnfDoc() {
  return (
    <div className="mx-auto rounded-xl" style={{ maxWidth: 560, background: "white", border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)", padding: 20, fontSize: 12, color: "#0F172A" }}>
      <div className="flex justify-between pb-2" style={{ borderBottom: "2px solid #0F172A" }}>
        <p className="font-bold" style={{ color: "#4F46E5" }}>Example Studio</p>
        <p className="font-bold">Full &amp; Final Settlement</p>
      </div>
      <p className="py-2" style={{ color: "#475569" }}>Deepak N · Operations · Last working day 31 May 2026</p>
      {[["Salary for notice period (12 days)", 18960, 1], ["Leave encashment — §10(10AA) exempt", 14400, 1], ["Gratuity — §10(10) exempt", 48076, 1], ["Notice shortfall recovery", -12500, -1], ["Asset recovery (charger not returned)", -1500, -1]].map(([l, v, s]) => (
        <div key={l as string} className="flex justify-between py-1" style={{ borderBottom: "1px solid #F0F2F8" }}>
          <span>{l}</span><span className="lp-num font-semibold" style={{ color: (s as number) < 0 ? "#DC2626" : "#0F172A" }}>{inr(Math.abs(v as number))}{(s as number) < 0 ? " (−)" : ""}</span>
        </div>
      ))}
      <div className="flex justify-between font-bold mt-2 pt-2 text-[13px]" style={{ borderTop: "1.5px solid #0F172A" }}>
        <span>Net settlement payable</span><span className="lp-num" style={{ color: "#059669" }}>{inr(67436)}</span>
      </div>
    </div>
  );
}

export function IdCardDoc() {
  return (
    <div className="mx-auto rounded-2xl overflow-hidden" style={{ width: 280, background: "white", border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)" }}>
      <div className="p-4 text-center" style={{ background: "#4F46E5" }}>
        <p className="text-white font-bold text-[14px]">Example Studio</p>
        <p className="text-[10px]" style={{ color: "#C7D2FE" }}>EMPLOYEE ID CARD</p>
      </div>
      <div className="p-4 text-center">
        <span className="inline-flex w-16 h-16 rounded-full items-center justify-center text-[20px] font-bold text-white" style={{ background: "#0F172A" }}>AK</span>
        <p className="mt-2 font-bold text-[15px]">Arun Kumar</p>
        <p className="text-[11px]" style={{ color: "#64748B" }}>Sales Executive · EMP-0004</p>
        <div className="mt-3 text-left text-[10.5px] space-y-1" style={{ color: "#475569" }}>
          <p>Joined: Mar 2024 · Blood group: O+</p>
          <p>Valid through: Mar 2027</p>
          <p>If found, return to Example Studio, Example City</p>
        </div>
      </div>
    </div>
  );
}

export function GstReturnDoc() {
  return (
    <div className="mx-auto rounded-xl" style={{ maxWidth: 640, background: "white", border: "1px solid #E8EAEF", boxShadow: "var(--shadow-card)", padding: 20, fontSize: 12, color: "#0F172A" }}>
      <div className="flex justify-between pb-2" style={{ borderBottom: "2px solid #0F172A" }}>
        <p className="font-bold" style={{ color: "#4F46E5" }}>GSTR-1 Summary · June 2026</p>
        <p className="font-bold">Example Studio · 33ABCDE1234F1Z5</p>
      </div>
      <table className="w-full mt-2" style={{ fontSize: 11.5 }}>
        <thead><tr style={{ background: "#F0F2F8" }}>{["Section", "Invoices", "Taxable value", "CGST", "SGST", "IGST"].map((h) => <th key={h} className="text-left px-2 py-1.5 font-bold">{h}</th>)}</tr></thead>
        <tbody>
          {[["B2B", 9, 382475, 34424, 34424, 0], ["B2CS", 4, 26000, 2340, 2340, 0], ["Exports / IGST", 1, 90000, 0, 0, 16200], ["Nil-rated", 1, 0, 0, 0, 0]].map((r) => (
            <tr key={r[0] as string} style={{ borderBottom: "1px solid #F0F2F8" }}>
              {r.map((c, i) => <td key={i} className={`px-2 py-1.5 ${i === 0 ? "font-semibold" : "lp-num"}`}>{i > 1 ? inr(c as number) : c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-2">
        <span className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: "#4F46E5" }}>Export GSTR-1 JSON</span>
        <span className="rounded-lg px-3 py-1.5 text-[11px] font-bold" style={{ background: "#F0F2F8", color: "#334155" }}>Export GSTR-3B</span>
      </div>
    </div>
  );
}

/* ── input form replica (real .card + form look, values from DEMO data) ── */
function DocForm({ label }: { label: string }) {
  const F = ({ l, v, w = "" }: { l: string; v: string; w?: string }) => (
    <div className={w}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>{l}</p>
      <div className="mt-1 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "white", border: "1px solid #D1D5E0" }}>{v}</div>
    </div>
  );
  /* Mirrors the real creation page (src/app/invoices/new): breadcrumb, Title,
     convert-from select, No/Date/Due/Status grid, Client, LineItemsEditor
     columns, Terms/Notes — same labels, same order. */
  const noun = label === "GST Invoice" ? "Invoice" : label;
  return (
    <div className="h-full overflow-hidden" style={{ background: "#F0F2F8", padding: 16, color: "#0F172A" }}>
      <p className="text-[10.5px]" style={{ color: "#94A3B8" }}>Sales &amp; Invoices › {noun}s › <span style={{ color: "#4F46E5", fontWeight: 600 }}>New</span></p>
      <input readOnly value={noun} className="mt-1 text-[18px] font-bold bg-transparent outline-none w-full" />
      <div className="mt-2"><F l="Convert from Quotation (optional)" v="QT-0341 — Sample Interiors · ₹1,18,000 ▾" /></div>
      <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <F l={`${noun} No`} v="INV-00248 · auto" />
        <F l={`${noun} Date *`} v="04-07-2026" />
        <F l="Due Date" v="19-07-2026" />
        <F l="Status" v="Draft ▾" />
      </div>
      <div className="mt-2.5"><F l="Client *" v="Sample Interiors — 33ABCDE1234F2Z6 ▾" /></div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Line Items</p>
      <div className="mt-1 rounded-lg overflow-hidden" style={{ border: "1px solid #D1D5E0" }}>
        <div className="grid grid-cols-[18px_1fr_52px_44px_36px_64px_58px_64px] gap-1 px-2 py-1.5 text-[9px] font-medium" style={{ background: "#E8EAEF", color: "#64748B" }}>
          <span>#</span><span>Item</span><span>HSN/SAC</span><span>GST %</span><span>Qty</span><span className="text-right">Rate (₹)</span><span>Discount</span><span className="text-right">Total</span>
        </div>
        <div className="grid grid-cols-[18px_1fr_52px_44px_36px_64px_58px_64px] gap-1 px-2 py-2 text-[10.5px] items-center" style={{ background: "white" }}>
          <span style={{ color: "#94A3B8" }}>1</span><span>Monthly design retainer — July</span><span className="lp-num">9983</span><span className="lp-num text-center">18</span><span className="lp-num text-center">1</span><span className="lp-num text-right">1,00,000</span><span className="lp-num text-center">—</span><span className="lp-num text-right font-semibold">1,18,000</span>
        </div>
        <div className="px-2 py-1.5 text-[10.5px] font-semibold" style={{ background: "#F8FAFF", color: "#4F46E5" }}>+ Add Item</div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <F l="Terms & Conditions" v="Payment due within 15 days…" />
        <F l="Notes" v="Thank you for your business!" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[11px]" style={{ color: "#64748B" }}>Subtotal {inr(100000)} · CGST {inr(9000)} · SGST {inr(9000)} · <b style={{ color: "#0F172A" }}>Total {inr(118000)}</b></div>
        <span className="inline-flex rounded-lg px-4 py-2 text-[12px] font-bold text-white" style={{ background: "#4F46E5" }}>Save {noun}</span>
      </div>
    </div>
  );
}

/* ── Before/After: what you type → what it produces ─────────────────────── */
export function InputOutputSlider({ label, children }: { label: string; children: React.ReactNode }) {
  const [x, setX] = useState(46);
  return (
    <div className="relative w-full max-w-[880px] mx-auto rounded-2xl overflow-hidden"
         style={{ border: "1px solid var(--lp-line)", boxShadow: "0 20px 50px -25px oklch(0.2 0.02 240 / 0.25)", background: "white" }}>
      {/* after (output) — in normal flow, so the container grows to the FULL document height */}
      <div className="overflow-x-auto flex items-start justify-center p-4">{children}</div>
      {/* before (input form) — clipped overlay */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        <DocForm label={label} />
      </div>
      {/* divider */}
      <div className="absolute top-0 bottom-0 w-0.5 pointer-events-none" style={{ left: `${x}%`, background: "var(--lp-brand)" }}>
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: "var(--lp-brand)" }}>⇄</span>
      </div>
      <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: "#0F172A", color: "white" }}>You type this</span>
      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: "#047857", color: "white" }}>It produces this</span>
      <input type="range" min={4} max={96} value={x} onChange={(e) => setX(Number(e.target.value))}
             aria-label="Reveal input or output" className="absolute inset-x-0 bottom-2 w-full opacity-0 cursor-ew-resize" style={{ height: "100%" }} />
    </div>
  );
}

/* ── gallery: 12 real outputs, doc types get the input→output slider ────── */
const GALLERY: { label: string; doc?: { type: RealDocType; no: string; status: string; title: string }; custom?: React.ReactNode }[] = [
  { label: "GST Invoice", doc: { type: "Invoice", no: "INV-00248", status: "Paid", title: "Design retainer — July" } },
  { label: "Quotation", doc: { type: "Quotation", no: "QT-0341", status: "Won", title: "Design retainer — July" } },
  { label: "Payment Receipt", doc: { type: "Payment Receipt", no: "RCP-0161", status: "Settled", title: "Payment against INV-00248" } },
  { label: "Sales Order", doc: { type: "Sales Order", no: "SO-0088", status: "InProgress", title: "Design retainer — July" } },
  { label: "Delivery Challan", doc: { type: "Delivery Challan", no: "DC-0054", status: "Sent", title: "Dispatch against SO-0088" } },
  { label: "Purchase Order", doc: { type: "Purchase Order", no: "PO-0034", status: "Sent", title: "Print collateral order" } },
  { label: "Debit Note", doc: { type: "Debit Note", no: "DN-0004", status: "Sent", title: "Return against BILL-0067" } },
  { label: "Goods Receipt", doc: { type: "Goods Receipt Note", no: "GRN-0021", status: "Done", title: "Receipt against PO-0033" } },
  { label: "Salary Slip", custom: <PayslipDoc /> },
  { label: "Offer Letter", custom: <LetterDoc tplId="offer-letter" values={{ employee: "Arun Kumar", role: "Sales Executive", ctc: "5,40,000", joining: "01 Aug 2026", date: "07 Jul 2026" }} /> },
  { label: "Appointment Letter", custom: <LetterDoc tplId="appointment-letter" values={{ employee: "Arun Kumar", role: "Sales Executive", ctc: "5,40,000", joining: "01 Aug 2026", date: "07 Jul 2026", location: "Example City", probation: "3 months", notice: "30 days" }} /> },
  { label: "Experience Letter", custom: <LetterDoc tplId="experience-letter" values={{ employee: "Deepak N", role: "Operations", from: "Jan 2023", to: "May 2026", date: "31 May 2026" }} /> },
  { label: "NDA", custom: <LetterDoc tplId="nda" values={{ party: "Sample Interiors", purpose: "design engagement", date: "07 Jul 2026", term: "2 years" }} /> },
  { label: "F&F Settlement", custom: <FnfDoc /> },
  { label: "Employee ID Card", custom: <IdCardDoc /> },
  { label: "GST Return", custom: <GstReturnDoc /> },
];

/* Tabbed gallery of real outputs — used on landing Ch04 and the features page. */
export default function RealDocGallery() {
  const [i, setI] = useState(0);
  const g = GALLERY[i];
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center">
        {GALLERY.map((d, j) => (
          <button key={d.label} onClick={() => setI(j)}
            className="rounded-full px-4 py-2 text-[12.5px] font-semibold cursor-pointer transition-colors"
            style={{
              background: i === j ? "var(--lp-ink)" : "var(--lp-paper)",
              color: i === j ? "white" : "var(--lp-ink)",
              border: `1px solid ${i === j ? "var(--lp-ink)" : "var(--lp-line)"}`,
            }}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {g.doc ? (
          <InputOutputSlider key={g.label} label={g.label}>
            <div style={{ minWidth: 680, background: "white" }}>
              <RealDoc type={g.doc.type} no={g.doc.no} status={g.doc.status} title={g.doc.title} />
            </div>
          </InputOutputSlider>
        ) : (
          <div key={g.label}>{g.custom}</div>
        )}
      </div>
      <p className="mt-3 text-center text-[12px]" style={{ color: "var(--lp-mute)" }}>
        {g.doc ? "Drag the handle — left is the form you fill, right is the exact document it generates." :
          "Generated from the same sample data — example company, no real identities."}
      </p>
    </div>
  );
}
