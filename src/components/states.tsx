"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";

/** Shared empty/loading/error states for list pages. */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-14 text-center">
      <Icon size={32} className="mx-auto text-gray-300 mb-3" aria-hidden />
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="px-4 py-10 text-center">
      <AlertTriangle size={28} className="mx-auto text-red-400 mb-3" aria-hidden />
      <p className="text-sm font-semibold text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 h-9 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}
