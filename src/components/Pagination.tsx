"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 sm:px-5">
      <span className="text-[12px] text-slate-400">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center justify-center w-8 h-8 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "#fff",
            borderColor: "#D1D5E0",
            color: "#64748B",
          }}
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[12px] text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="flex items-center justify-center w-8 h-8 rounded-lg border text-[12px] font-semibold transition-colors"
              style={{
                background: p === page ? "#4F46E5" : "#fff",
                borderColor: p === page ? "#4F46E5" : "#D1D5E0",
                color: p === page ? "#fff" : "#64748B",
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-8 h-8 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "#fff",
            borderColor: "#D1D5E0",
            color: "#64748B",
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
