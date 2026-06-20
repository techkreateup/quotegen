"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center" role="alert">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
        <AlertTriangle size={22} className="text-red-500" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          An unexpected error occurred while loading this page. You can try again.
        </p>
      </div>
      <button
        onClick={reset}
        className="h-9 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  );
}
