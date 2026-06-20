"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Shared building blocks for the Super Admin console. Tailwind-based to match
// the existing /admin pages.

export function StatCard({
  label,
  value,
  hint,
  trend,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: number | null;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="text-2xl font-bold text-slate-900">{loading ? "…" : value}</p>
        {trend != null && !loading && (
          <span
            className={`text-xs font-semibold mb-1 ${
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-slate-400"
            }`}
          >
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "–"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          {title && <h2 className="text-sm font-bold text-slate-700">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// Simple, dependency-free bar chart for trends.
export function MiniBars({ data, color = "#6366F1" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: 88 }}>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0, background: color }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[10px] text-slate-400">{d.label}</span>
          <span className="text-[11px] font-semibold text-slate-600">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "red" | "amber" | "slate" | "indigo"; children: ReactNode }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
        {label}
      </td>
    </tr>
  );
}

export function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-indigo-600 hover:underline">
      {children}
    </Link>
  );
}
