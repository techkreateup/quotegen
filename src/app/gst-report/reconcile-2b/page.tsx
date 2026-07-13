"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/api";
import { Upload } from "lucide-react";

interface Line {
  status: "matched" | "value_mismatch" | "missing_in_books" | "missing_in_2b";
  supplierGstin: string; supplierName: string; docNo: string;
  b2bTotal: number | null; bookTotal: number | null; billId: string | null; note: string;
}
interface Result { lines: Line[]; counts: Record<string, number>; b2bDocs: number; bills: number }

const money = (n: number | null) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const badge: Record<Line["status"], [string, string]> = {
  matched: ["Matched", "bg-emerald-50 text-emerald-700"],
  value_mismatch: ["Value mismatch", "bg-amber-50 text-amber-700"],
  missing_in_books: ["Not in books", "bg-blue-50 text-blue-700"],
  missing_in_2b: ["Not in 2B", "bg-red-50 text-red-700"],
};

export default function Reconcile2BPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<Line["status"] | "all">("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | null) {
    if (!f) return;
    setBusy(true); setError("");
    try {
      const json = await f.text();
      setResult(await apiPost<Result>("/api/gst-report/reconcile-2b", { json }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconciliation failed");
      setResult(null);
    } finally { setBusy(false); }
  }

  const rows = result?.lines.filter((l) => filter === "all" || l.status === filter) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="GSTR-2B Reconciliation" breadcrumbs={[{ label: "Compliance" }, { label: "GST Returns" }, { label: "2B Recon" }]}
        subtitle="Upload the GSTR-2B JSON from the GST portal — supplier filings are matched against your recorded purchase bills to protect input tax credit." />

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
        <Upload className="h-4 w-4" /> {busy ? "Reconciling…" : "Upload GSTR-2B JSON"}
        <input type="file" accept=".json,application/json" className="hidden" disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>}

      {result && (
        <>
          <div className="flex flex-wrap gap-2 text-[12px]">
            {(["all", "matched", "value_mismatch", "missing_in_books", "missing_in_2b"] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 ${filter === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                {k === "all" ? `All (${result.lines.length})` : `${badge[k][0]} (${result.counts[k] ?? 0})`}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">Doc no</th><th className="px-3 py-2 text-right">2B value</th><th className="px-3 py-2 text-right">Books</th><th className="px-3 py-2">Note</th></tr>
              </thead>
              <tbody>
                {rows.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge[l.status][1]}`}>{badge[l.status][0]}</span></td>
                    <td className="px-3 py-2">{l.supplierName || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{l.supplierGstin || "—"}</td>
                    <td className="px-3 py-2">{l.docNo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.b2bTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.bookTotal)}</td>
                    <td className="px-3 py-2 text-slate-500">{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
