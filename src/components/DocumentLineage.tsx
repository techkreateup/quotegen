"use client";

import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";

export interface RelatedDoc {
  kind: string;
  label: string;
  no: string;
  href: string;
  status: string;
}
export interface Lineage {
  source: RelatedDoc[];
  children: RelatedDoc[];
}

// Visualises the document chain Quotation → Sales Order → Delivery Challan →
// Invoice so a user always sees where a document came from and what it produced —
// no dead ends. The current document sits in the middle, highlighted.
export default function DocumentLineage({
  related,
  current,
  hint,
}: {
  related?: Lineage | null;
  current: { label: string; no: string };
  hint?: string; // e.g. "Convert to an invoice to bill this order"
}) {
  const source = related?.source ?? [];
  const children = related?.children ?? [];
  const hasAny = source.length > 0 || children.length > 0;

  const chip = (d: RelatedDoc, dim = false) => (
    <Link key={d.href} href={d.href}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors"
      style={{
        borderColor: dim ? "#E2E8F0" : "#C7D2FE",
        background: dim ? "#F8FAFC" : "#EEF2FF",
        color: dim ? "#475569" : "#4338CA",
      }}>
      <span className="text-[10px] uppercase tracking-wide opacity-60">{d.label}</span>
      <span className="font-semibold">{d.no}</span>
      <span className="text-[10px] rounded px-1 py-0.5" style={{ background: "rgba(15,23,42,0.06)" }}>{d.status}</span>
    </Link>
  );

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch size={14} className="text-slate-400" />
        <span className="text-[12.5px] font-semibold text-slate-700">Document Trail</span>
        {!hasAny && <span className="text-[11.5px] text-slate-400">— not linked to any other document</span>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {source.map((d) => (
          <span key={d.href} className="inline-flex items-center gap-2">
            {chip(d, true)}
            <ArrowRight size={14} className="text-slate-300" />
          </span>
        ))}

        <span className="inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-[12px]"
          style={{ borderColor: "#6366F1", background: "#fff", color: "#4338CA" }}>
          <span className="text-[10px] uppercase tracking-wide opacity-60">{current.label}</span>
          <span className="font-bold">{current.no}</span>
        </span>

        {children.map((d) => (
          <span key={d.href} className="inline-flex items-center gap-2">
            <ArrowRight size={14} className="text-slate-300" />
            {chip(d)}
          </span>
        ))}
      </div>

      {hint && children.length === 0 && (
        <p className="text-[11.5px] text-slate-400 mt-3 flex items-center gap-1.5">
          <ArrowRight size={12} /> {hint}
        </p>
      )}
    </div>
  );
}
