"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Receipt, Download, FileText, CreditCard, CheckCircle2, XCircle, Clock, RotateCcw, Ban } from "lucide-react";

interface InvoiceLite {
  id: string;
  invoiceNumber: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}
interface BillingRow {
  id: string;
  createdAt: string;
  planName: string | null;
  amount: number; // paise
  currency: string;
  status: "CREATED" | "CAPTURED" | "FAILED" | "REFUNDED";
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  invoice: InvoiceLite | null;
}

const STATUS_META: Record<BillingRow["status"], { label: string; tone: string; Icon: typeof Clock }> = {
  CREATED: { label: "Pending", tone: "text-amber-600 bg-amber-50", Icon: Clock },
  CAPTURED: { label: "Paid", tone: "text-emerald-600 bg-emerald-50", Icon: CheckCircle2 },
  FAILED: { label: "Failed", tone: "text-rose-600 bg-rose-50", Icon: XCircle },
  REFUNDED: { label: "Refunded", tone: "text-slate-500 bg-slate-50", Icon: RotateCcw },
};

interface PlanInfo {
  subscriptionStatus: string;
  currentPlanId: string | null;
  currentPeriodEnd: string | null;
}

export default function BillingPage() {
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelDialog, setCancelDialog] = useState(false);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
    fetch("/api/plan")
      .then((r) => r.json())
      .then((d) => (d.error ? null : setPlanInfo(d)))
      .catch(() => {});
  }, []);

  async function confirmCancel() {
    setCanceling(true); setCancelError("");
    const r = await fetch("/api/billing/cancel", { method: "POST" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setCancelError(e.error || "Cancel failed");
      setCanceling(false);
      return;
    }
    // Refresh plan info; subscription is now CANCELED
    const fresh = await fetch("/api/plan").then((r) => r.json()).catch(() => null);
    if (fresh && !fresh.error) setPlanInfo(fresh);
    setCanceling(false);
    setCancelDialog(false);
  }

  const isPaid = !!planInfo && planInfo.subscriptionStatus === "ACTIVE" && !!planInfo.currentPlanId;
  const isCanceled = planInfo?.subscriptionStatus === "CANCELED";
  const periodEndLabel = planInfo?.currentPeriodEnd
    ? new Date(planInfo.currentPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const captured = rows?.filter((r) => r.status === "CAPTURED") ?? [];
  const totalPaid = captured.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Billing & Invoices"
        subtitle="Payment history and downloadable GST invoices for your subscription."
        breadcrumbs={[{ label: "Account" }, { label: "Billing" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs"><CreditCard size={14} /> Total paid</div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{inr(totalPaid)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">across {captured.length} payment{captured.length === 1 ? "" : "s"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs"><FileText size={14} /> Invoices issued</div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{rows?.filter((r) => r.invoice).length ?? "—"}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">GST tax invoices (SAC 9983)</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs"><Receipt size={14} /> Current plan</div>
          {planInfo ? (
            <>
              <p className="text-2xl font-bold text-slate-900 mt-1">{planInfo.currentPlanId || planInfo.subscriptionStatus}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isCanceled ? "Canceled — access until period end" : isPaid && periodEndLabel ? `Renews on ${periodEndLabel}` : planInfo.subscriptionStatus.toLowerCase()}
              </p>
              <div className="flex gap-2 mt-3">
                <Link href="/plans" className="btn btn-outline btn-sm">Change plan</Link>
                {isPaid && (
                  <button
                    onClick={() => { setCancelError(""); setCancelDialog(true); }}
                    className="text-xs font-semibold text-rose-600 hover:underline px-2"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700 mt-1">Loading…</p>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Payment history</h2>
        </div>
        {rows == null ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No payments yet.</p>
            <Link href="/plans" className="text-xs text-indigo-600 font-semibold hover:underline">Choose a plan →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Plan</th>
                  <th className="px-5 py-3 font-semibold">Invoice</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const Icon = meta.Icon;
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-5 py-3 text-slate-700 font-medium">{r.planName || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-xs">{r.invoice?.invoiceNumber || "—"}</td>
                      <td className="px-5 py-3 text-slate-900 font-semibold whitespace-nowrap">{inr(r.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.tone}`}>
                          <Icon size={11} /> {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.invoice ? (
                          <div className="inline-flex items-center gap-3">
                            <a
                              href={`/api/billing/invoices/${r.invoice.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              <FileText size={12} /> Invoice
                            </a>
                            <a
                              href={`/api/billing/invoices/${r.invoice.id}?variant=receipt`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline"
                            >
                              <Download size={12} /> Receipt
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelDialog && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Ban size={20} />
              </span>
              <div className="flex-1">
                <h2 id="cancel-title" className="text-base font-bold text-slate-900">Cancel subscription?</h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  Your <strong>{planInfo?.currentPlanId}</strong> plan will be canceled. You'll keep access
                  {periodEndLabel ? ` until ${periodEndLabel}` : " until the end of the current period"},
                  then drop to the Free plan. You can resubscribe anytime.
                </p>
                {cancelError && <p className="text-xs text-rose-600 mt-2">{cancelError}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setCancelDialog(false)}
                disabled={canceling}
                className="btn btn-outline btn-sm"
              >
                Keep subscription
              </button>
              <button
                onClick={confirmCancel}
                disabled={canceling}
                className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
              >
                {canceling ? "Canceling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
