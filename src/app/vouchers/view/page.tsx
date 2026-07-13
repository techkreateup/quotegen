"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { CompanySettings } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { downloadPdf } from "@/lib/pdf";
import { Download, Printer, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface VoucherData {
  id: string;
  voucherNo: string;
  voucherDate: string;
  paidTo: string;
  amount: number;
  amountInWords: string;
  description: string;
  paymentMethod: string;
  checkedByName: string;
  checkedBySig: string;
  approvedByName: string;
  approvedBySig: string;
  paidByName: string;
  paidBySig: string;
  receivedByName: string;
  receivedBySig: string;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  employee: { name: string; employeeCode: string; designation: string; bankName: string; accountNumber: string; ifsc: string; accountName: string; signatureUrl: string };
  salaryRecord: { month: number; year: number; basicSalary: number; deductions: number; bonuses: number; netSalary: number } | null;
}

function VoucherView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [voucher, setVoucher] = useState<VoucherData | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const load = () => {
    if (id) apiGet<VoucherData>(`/api/vouchers/${id}`).then(setVoucher).catch(() => {});
    apiGet<CompanySettings>("/api/settings").then(setSettings).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
  };

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const acknowledge = async () => {
    if (!voucher) return;
    if ((await confirmDialog({ title: "Please confirm", tone: "danger", message: "Mark this voucher as acknowledged/received?" }))) {
      try {
        await apiPost(`/api/vouchers/${voucher.id}/acknowledge`, {
          receivedByName: voucher.paidTo,
          receivedBySig: voucher.employee.signatureUrl || "",
        });
        load();
      } catch {}
    }
  };

  if (!voucher || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>;

  const themeColor = settings.themeColor || "#6366F1";

  const sigCheckedBySig = voucher.checkedBySig || settings.checkedBySig;
  const sigCheckedByName = voucher.checkedByName || settings.checkedByName;
  const sigApprovedBySig = voucher.approvedBySig || settings.approvedBySig;
  const sigApprovedByName = voucher.approvedByName || settings.approvedByName;
  const sigPaidBySig = voucher.paidBySig || settings.paidBySig;
  const sigPaidByName = voucher.paidByName || settings.paidByName;

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Payment Voucher"
        breadcrumbs={[{ label: "HR & Payroll" }, { label: "Vouchers", href: "/vouchers" }, { label: voucher.voucherNo }]}
        action={
          <div className="flex items-center gap-2">
            {!voucher.isAcknowledged && (
              <button onClick={acknowledge} className="btn btn-outline btn-sm">
                <CheckCircle size={13} /> Acknowledge
              </button>
            )}
            <button onClick={() => downloadPdf("voucher-print", `${voucher.voucherNo}.pdf`)} className="btn btn-outline btn-sm">
              <Download size={13} /> Download
            </button>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={13} /> Print
            </button>
          </div>
        }
      />

      {/* Printable voucher */}
      <div className="print-zone" id="voucher-print">
        <div style={{
          maxWidth: 800, margin: "0 auto", background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 8, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ background: themeColor, color: "#fff", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const }}>
            <div>
              {settings.logoUrl && <img src={settings.logoUrl} alt="" style={{ height: 40, marginBottom: 8, borderRadius: 4 }} />}
              <div style={{ fontSize: 18, fontWeight: 700 }}>{settings.businessName || "Company"}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{[settings.address, settings.city, settings.state, settings.pincode].filter(Boolean).join(", ")}</div>
              {settings.gstin && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>GSTIN: {settings.gstin}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>PAYMENT VOUCHER</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>{voucher.voucherNo}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{fmtDate(voucher.voucherDate)}</div>
            </div>
          </div>

          <div style={{ padding: "24px 28px" }}>
            {/* Paid To section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" style={{ marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Paid To</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{voucher.paidTo}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{voucher.employee.employeeCode} · {voucher.employee.designation}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Payment Method</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{voucher.paymentMethod}</div>
                {voucher.employee.bankName && (
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    {voucher.employee.bankName} · A/c: {voucher.employee.accountNumber}
                    {voucher.employee.ifsc && <span> · IFSC: {voucher.employee.ifsc}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Salary breakdown */}
            {voucher.salaryRecord && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Salary Breakdown — {MONTHS[voucher.salaryRecord.month - 1]} {voucher.salaryRecord.year}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 0", color: "#64748B" }}>Basic Salary</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{fmt(voucher.salaryRecord.basicSalary)}</td>
                    </tr>
                    {voucher.salaryRecord.deductions > 0 && (
                      <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 0", color: "#DC2626" }}>Deductions</td>
                        <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: "#DC2626" }}>-{fmt(voucher.salaryRecord.deductions)}</td>
                      </tr>
                    )}
                    {voucher.salaryRecord.bonuses > 0 && (
                      <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 0", color: "#059669" }}>Bonuses</td>
                        <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: "#059669" }}>+{fmt(voucher.salaryRecord.bonuses)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 14, color: "#1E293B" }}>Net Amount</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 800, fontSize: 16, color: themeColor }}>{fmt(voucher.salaryRecord.netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Amount box */}
            <div style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8,
              padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount Paid</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: themeColor, marginTop: 4 }}>{fmt(voucher.amount)}</div>
                {voucher.amountInWords && <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, fontStyle: "italic" }}>{voucher.amountInWords}</div>}
              </div>
              {voucher.isAcknowledged && (
                <div style={{ textAlign: "center", padding: "8px 16px", border: "2px solid #059669", borderRadius: 8, color: "#059669" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Acknowledged</div>
                  {voucher.acknowledgedAt && <div style={{ fontSize: 10, marginTop: 2 }}>{fmtDate(voucher.acknowledgedAt)}</div>}
                </div>
              )}
            </div>

            {voucher.description && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{voucher.description}</div>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #E2E8F0" }}>
              {[
                { label: "Checked By", name: sigCheckedByName, sig: sigCheckedBySig },
                { label: "Approved By", name: sigApprovedByName, sig: sigApprovedBySig },
                { label: "Paid By", name: sigPaidByName, sig: sigPaidBySig },
                { label: "Received By", name: voucher.receivedByName, sig: voucher.receivedBySig },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ height: 52, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 4 }}>
                    {s.sig ? (
                      <img src={s.sig} alt="" style={{ maxHeight: 48, maxWidth: "100%", objectFit: "contain" }} />
                    ) : (
                      <div style={{ borderBottom: "1px dashed #CBD5E1", width: "80%", height: 1 }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{s.name || "—"}</div>
                  <div style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", marginTop: 2, letterSpacing: "0.05em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* System generated notice */}
            <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #F1F5F9", textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>
                This is a system generated document. Computer generated vouchers do not require physical signatures.
              </p>
              {!settings.hideDefaultBrand && (
                <p style={{ marginTop: 6, fontSize: 10, color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/quotegen/QG_icon_SVG.svg" alt="" style={{ width: 12, height: 12, display: "inline-block" }} />
                  e-signed via <a href="https://quotegen.kreateup.in" target="_blank" rel="noopener noreferrer" style={{ color: "#4338CA", fontWeight: 600, textDecoration: "none" }}>QuoteGen</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VoucherViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <VoucherView />
    </Suspense>
  );
}
