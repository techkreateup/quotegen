"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/api";
import { Upload, CheckCircle2 } from "lucide-react";

interface Suggestion {
  row: { date: string; description: string; amount: number; reference: string };
  side: "receivable" | "payable";
  docId: string | null; docNumber: string | null; party: string | null; partyId: string | null;
  confidence: "high" | "medium" | "low" | "none"; reason: string;
}

const money = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
const confColor: Record<string, string> = { high: "text-emerald-600", medium: "text-blue-600", low: "text-amber-600", none: "text-slate-400" };

export default function BankReconcilePage() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  async function onFile(f: File | null) {
    if (!f) return;
    setBusy(true); setError(""); setDone(new Set());
    try {
      const csv = await f.text();
      const res = await apiPost<{ suggestions: Suggestion[] }>("/api/cash/bank-recon", { csv });
      setSuggestions(res.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setSuggestions(null);
    } finally { setBusy(false); }
  }

  async function createReceipt(s: Suggestion, idx: number) {
    if (!s.docId) return;
    setBusy(true); setError("");
    try {
      await apiPost("/api/receipts", {
        invoiceId: s.docId, clientId: s.partyId, amount: Math.abs(s.row.amount),
        paymentMethod: "Bank Transfer", referenceNo: s.row.reference || s.row.date,
        notes: `Bank recon: ${s.row.description}`.slice(0, 300),
      });
      setDone((d) => new Set(d).add(idx));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt creation failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Bank Reconciliation" subtitle="Import a bank statement CSV — credits are matched to open invoices, debits to unpaid vendor bills." />

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
        <Upload className="h-4 w-4" /> {busy ? "Working…" : "Import statement CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>}

      {suggestions && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Narration</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Suggested match</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {suggestions.map((s, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{s.row.date}</td>
                  <td className="px-3 py-2 max-w-[320px] truncate" title={s.row.description}>{s.row.description}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.row.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>{s.row.amount > 0 ? "+" : "−"}{money(s.row.amount)}</td>
                  <td className="px-3 py-2">{s.docNumber ? <>{s.docNumber} · {s.party}</> : <span className="text-slate-400">—</span>}</td>
                  <td className={`px-3 py-2 ${confColor[s.confidence]}`} title={s.reason}>{s.confidence}</td>
                  <td className="px-3 py-2 text-right">
                    {done.has(i) ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Settled</span>
                    ) : s.side === "receivable" && s.docId ? (
                      <button onClick={() => createReceipt(s, i)} disabled={busy} className="rounded bg-slate-800 px-2.5 py-1 text-[12px] text-white disabled:opacity-50">Create receipt</button>
                    ) : s.side === "payable" && s.docId ? (
                      <a href="/payables/pay-run" className="text-[12px] text-blue-600 underline">Record via pay run</a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
