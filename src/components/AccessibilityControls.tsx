"use client";

import { useAccessibility } from "@/components/AccessibilityProvider";
import type { FontScale } from "@/lib/accessibility";
import { Contrast, Eye, Link2, MousePointer2, RotateCcw, Type, Zap } from "lucide-react";

const SIZES: { value: FontScale; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xl", label: "Extra Large" },
];

/** Shared accessibility settings UI — rendered in the floating widget and the
 *  Settings → Accessibility page so both stay in sync. */
export default function AccessibilityControls() {
  const { settings, set, reset } = useAccessibility();

  const toggles: { key: keyof typeof settings; label: string; desc: string; icon: typeof Eye }[] = [
    { key: "highContrast", label: "High contrast", desc: "Maximise text and border contrast", icon: Contrast },
    { key: "highlightFocus", label: "Highlight focus", desc: "Show a bold ring on the focused element", icon: MousePointer2 },
    { key: "underlineLinks", label: "Underline links", desc: "Distinguish links by more than colour", icon: Link2 },
    { key: "readableFont", label: "Readable font", desc: "Use a higher-legibility typeface", icon: Type },
    { key: "reduceMotion", label: "Reduce motion", desc: "Turn off animations and transitions", icon: Zap },
  ];

  return (
    <div className="space-y-5">
      {/* Text size */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Eye size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Text &amp; interface size</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Interface size"
          className="grid grid-cols-3 gap-2"
        >
          {SIZES.map((s) => {
            const active = settings.fontScale === s.value;
            return (
              <button
                key={s.value}
                role="radio"
                aria-checked={active}
                onClick={() => set("fontScale", s.value)}
                className="transition-all"
                style={{
                  padding: "9px 6px",
                  borderRadius: 10,
                  border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                  background: active ? "var(--primary-light)" : "var(--surface)",
                  color: active ? "var(--primary)" : "var(--text-2)",
                  fontWeight: active ? 700 : 600,
                  cursor: "pointer",
                  fontSize: s.value === "normal" ? 12.5 : s.value === "large" ? 13.5 : 15,
                }}
              >
                A{s.value !== "normal" && <span aria-hidden>+</span>}
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        {toggles.map(({ key, label, desc, icon: Icon }) => {
          const on = settings[key] as boolean;
          return (
            <button
              key={key}
              role="switch"
              aria-checked={on}
              onClick={() => set(key, !on)}
              className="w-full flex items-center gap-3 transition-colors"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1.5px solid var(--border)",
                background: on ? "var(--primary-light)" : "var(--surface)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Icon size={16} style={{ color: on ? "var(--primary)" : "var(--text-3)", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-3)" }}>{desc}</span>
              </span>
              {/* switch track */}
              <span
                aria-hidden
                style={{
                  width: 38, height: 22, borderRadius: 999, flexShrink: 0, position: "relative",
                  background: on ? "var(--primary)" : "#CBD2DE", transition: "background 160ms",
                }}
              >
                <span
                  style={{
                    position: "absolute", top: 3, left: on ? 19 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 160ms", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-1.5 transition-colors"
        style={{
          padding: "9px", borderRadius: 10, border: "1.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}
      >
        <RotateCcw size={13} /> Reset to defaults
      </button>
    </div>
  );
}
