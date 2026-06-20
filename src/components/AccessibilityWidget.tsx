"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, X } from "lucide-react";
import AccessibilityControls from "@/components/AccessibilityControls";

/** Always-available floating launcher for the accessibility menu.
 *  Rendered at the document root so it appears on every page, including
 *  logged-out pages (login, signup, landing). */
export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape; restore focus to the launcher.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Accessibility settings"
        aria-expanded={open}
        title="Accessibility settings"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 60,
          width: 46,
          height: 46,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(79,70,229,0.45)",
        }}
        className="a11y-launcher"
      >
        <Accessibility size={22} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Accessibility settings"
          aria-modal="false"
          style={{
            position: "fixed",
            right: 16,
            bottom: 72,
            zIndex: 61,
            width: "min(340px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 110px)",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow-modal)",
            padding: 18,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Accessibility size={18} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)" }}>Accessibility</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close accessibility settings"
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
          <AccessibilityControls />
        </div>
      )}
    </>
  );
}
