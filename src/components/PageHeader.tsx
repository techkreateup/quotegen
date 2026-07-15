"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function PageHeader({ title, subtitle, action, breadcrumbs }: Props) {
  return (
    <div className="w-full no-print">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} className="text-slate-300" />}
              {c.href
                ? <Link href={c.href} className="text-[11px] sm:text-[12px] font-medium text-slate-400 hover:text-indigo-600 transition-colors">{c.label}</Link>
                : <span className="text-[11px] sm:text-[12px] font-medium text-slate-500">{c.label}</span>
              }
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-none">{title}</h1>
          {subtitle && <p className="text-[12px] sm:text-[13px] text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto"><div className="flex flex-nowrap items-center gap-2 min-w-max">{action}</div></div>}
      </div>
    </div>
  );
}
