"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Send } from "lucide-react";
import { renderHtmlToPdf } from "@/lib/pdf";
import { useToast } from "@/components/Toast";

interface Payment { id: string; vendorId: string; amount: number; grossAmount: number; tdsSection: string; tdsRate: number; tdsAmount: number; paidDate: string; description: string; paymentMethod: string; notes: string; vendor: { id: string; name: string; email: string; phone: string; address: string; gstin: string } }
interface Settings { businessName: string; address: string; city: string; state: string; pincode: string; email: string; phones: string[]; gstin: string; logoUrl: string; themeColor: string; website: string }
interface Bill { id: string; billNo: string; billDate: string; dueDate: string | null; totalAmount: number }
interface Resp { payment: Payment; settings: Settings; bills: Bill[]; debitNotes: { totalAmount: number }[]; allPayments: { id: string; amount: number; paidDate: string }[] }

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function RemittanceInner() {
  const sp = useSearchParams();
  const id = sp.get("id");
  const toast = useToast();
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/vendor-payments/${id}`).then(r => r.json()).then(setData).catch(() => {});
  }, [id]);

  // Match this payment against outstanding bills FIFO (oldest first). Any prior
  // payments consume balance first; whatever remains of this payment is applied.
  const applied = useMemo(() => {
    if (!data) return { covered: [] as { bill: Bill; applied: number }[], leftover: 0 };
    const priorPaid = data.allPayments
      .filter(p => new Date(p.paidDate) < new Date(data.payment.paidDate) || (new Date(p.paidDate).getTime() === new Date(data.payment.paidDate).getTime() && p.id < data.payment.id))
      .reduce((s, p) => s + p.amount, 0);
    const dn = data.debitNotes.reduce((s, d) => s + d.totalAmount, 0);
    let consumed = priorPaid + dn;
    let toApply = data.payment.amount;
    const covered: { bill: Bill; applied: number }[] = [];
    for (const b of data.bills) {
      const open = Math.max(0, b.totalAmount - consumed);
      consumed = Math.max(0, consumed - b.totalAmount);
      if (open <= 0 || toApply <= 0) continue;
      const use = Math.min(open, toApply);
      covered.push({ bill: b, applied: use });
      toApply -= use;
    }
    return { covered, leftover: Math.max(0, toApply) };
  }, [data]);

  async function downloadPdf() {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const pdf = await renderHtmlToPdf(sheetRef.current.innerHTML);
      pdf.save(`Remittance-${data?.payment.vendor.name || "vendor"}-${data?.payment.paidDate.slice(0,10)}.pdf`);
    } catch { toast.error("Could not build PDF"); } finally { setBusy(false); }
  }
  function print() { window.print(); }

  if (!id) return <div className="p-8 text-slate-400 text-[13px]">Missing payment id.</div>;
  if (!data) return <div className="p-8 text-slate-400 text-[13px]">Loading…</div>;

  const { payment, settings } = data;
  const accent = settings.themeColor || "#4F46E5";
  const companyAddress = [settings.address, settings.city, settings.state, settings.pincode].filter(Boolean).join(", ");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-2 mb-4 no-print">
        <Link href={`/vendors/view?id=${payment.vendorId}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-slate-700"><ArrowLeft size={14} /> Back to vendor</Link>
        <div className="flex items-center gap-2">
          <Link href={`/messages/send?entityType=vendor&entityId=${payment.vendorId}`} className="btn btn-sm"><Send size={13} /> Email</Link>
          <button onClick={print} className="btn btn-sm"><Printer size={13} /> Print</button>
          <button onClick={downloadPdf} disabled={busy} className="btn btn-sm btn-primary"><Download size={13} /> {busy ? "Building…" : "Download PDF"}</button>
        </div>
      </div>

      <div ref={sheetRef} className="mx-auto bg-white shadow-sm" style={{ maxWidth: 794, padding: "44px 56px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1F2937" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: `3px solid ${accent}`, paddingBottom: 16 }}>
          <div>
            {settings.logoUrl ? <img src={settings.logoUrl} alt="" style={{ height: 48, marginBottom: 8 }} /> : null}
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>{settings.businessName || "Your Company"}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{companyAddress}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{settings.email} · {settings.phones?.[0] || ""}</div>
            {settings.gstin ? <div style={{ fontSize: 11, color: "#6B7280" }}>GSTIN: {settings.gstin}</div> : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: -0.4 }}>REMITTANCE ADVICE</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Ref: RA-{payment.id.slice(-8).toUpperCase()}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Date: {fmt(payment.paidDate)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 22 }}>
          <div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.6 }}>PAID TO</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{payment.vendor.name}</div>
            {payment.vendor.address ? <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{payment.vendor.address}</div> : null}
            <div style={{ fontSize: 11, color: "#6B7280" }}>{payment.vendor.email}{payment.vendor.phone ? ` · ${payment.vendor.phone}` : ""}</div>
            {payment.vendor.gstin ? <div style={{ fontSize: 11, color: "#6B7280" }}>GSTIN: {payment.vendor.gstin}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.6 }}>PAYMENT DETAILS</div>
            <table style={{ width: "100%", fontSize: 12, marginTop: 4 }}>
              <tbody>
                {payment.tdsAmount > 0 ? (
                  <>
                    <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Gross</td><td style={{ textAlign: "right" }}>{money(payment.grossAmount)}</td></tr>
                    <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>TDS {payment.tdsSection ? `Sec ${payment.tdsSection}` : ""} @ {payment.tdsRate}%</td><td style={{ textAlign: "right", color: "#DC2626" }}>−{money(payment.tdsAmount)}</td></tr>
                    <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Net paid</td><td style={{ textAlign: "right", fontWeight: 700, color: accent, fontSize: 15 }}>{money(payment.amount)}</td></tr>
                  </>
                ) : (
                  <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Amount</td><td style={{ textAlign: "right", fontWeight: 700, color: accent, fontSize: 15 }}>{money(payment.amount)}</td></tr>
                )}
                <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Method</td><td style={{ textAlign: "right" }}>{payment.paymentMethod}</td></tr>
                <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Paid on</td><td style={{ textAlign: "right" }}>{fmt(payment.paidDate)}</td></tr>
                {payment.description ? <tr><td style={{ color: "#6B7280", padding: "3px 0" }}>Ref</td><td style={{ textAlign: "right" }}>{payment.description}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.6, marginBottom: 8 }}>APPLIED TO</div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", color: "#6B7280", fontSize: 11 }}>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>Bill No</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>Bill Date</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>Due Date</th>
                <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>Bill Total</th>
                <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>Applied</th>
              </tr>
            </thead>
            <tbody>
              {applied.covered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "16px 10px", textAlign: "center", color: "#9CA3AF" }}>Payment recorded on account (no specific bill matched).</td></tr>
              ) : applied.covered.map(({ bill, applied }) => (
                <tr key={bill.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px", fontWeight: 600 }}>{bill.billNo}</td>
                  <td style={{ padding: "10px", color: "#6B7280" }}>{fmt(bill.billDate)}</td>
                  <td style={{ padding: "10px", color: "#6B7280" }}>{fmt(bill.dueDate)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: "#6B7280" }}>{money(bill.totalAmount)}</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{money(applied)}</td>
                </tr>
              ))}
              {applied.leftover > 0 ? (
                <tr><td colSpan={4} style={{ padding: "10px", textAlign: "right", color: "#6B7280" }}>On account (unapplied)</td><td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{money(applied.leftover)}</td></tr>
              ) : null}
              <tr style={{ background: "#F9FAFB" }}>
                <td colSpan={4} style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>Total Remitted</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: accent, fontSize: 14 }}>{money(payment.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {payment.notes ? (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.6 }}>NOTES</div>
            <div style={{ fontSize: 12, color: "#4B5563", marginTop: 4, whiteSpace: "pre-wrap" }}>{payment.notes}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #E5E7EB", fontSize: 10.5, color: "#9CA3AF", textAlign: "center" }}>
          This is a computer-generated remittance advice from {settings.businessName || "our accounts team"}. No signature is required.
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
    </div>
  );
}

export default function VendorRemittancePage() {
  return <Suspense fallback={<div className="p-8 text-slate-400 text-[13px]">Loading…</div>}><RemittanceInner /></Suspense>;
}
