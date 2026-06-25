"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Receipt, Download, FileText, CreditCard, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";

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

export default function BillingPage() {
  const [rows, setRows] = useState<BillingRow[] | null>(null);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
  }, []);

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
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs"><Receipt size={14} /> Manage plan</div>
            <p className="text-sm text-slate-700 mt-1">Upgrade, downgrade or cancel</p>
          </div>
          <Link href="/plans" className="btn btn-outline btn-sm">View plans</Link>
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
                          <a
                            href={`/api/billing/invoices/${r.invoice.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <Download size={12} /> View invoice
                          </a>
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
    </div>
  );
}
