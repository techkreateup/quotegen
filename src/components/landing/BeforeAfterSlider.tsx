"use client";

import { useRef, useState } from "react";

/**
 * Drag to reveal: messy Excel column (left) → clean GST invoice (right).
 * Uses clip-path driven by a range input. No JS animation lib.
 * Static SVG "screenshots" so nothing depends on external assets.
 */
export default function BeforeAfterSlider() {
  const [x, setX] = useState(52);
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapRef}
      className="bas-wrap relative w-full max-w-[880px] mx-auto rounded-2xl overflow-hidden"
      style={{
        // @ts-expect-error inline CSS var
        "--bas-x": `${x}%`,
        aspectRatio: "16 / 9",
        background: "var(--lp-paper)",
        border: "1px solid var(--lp-line)",
        boxShadow: "0 20px 50px -25px oklch(0.2 0.02 240 / 0.25)",
      }}
    >
      {/* ── AFTER (base, right side always fully visible under the clipped top) ── */}
      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10" style={{ background: "linear-gradient(160deg, oklch(0.985 0.005 275), oklch(0.94 0.03 275))" }}>
        <div className="w-full max-w-[420px] rounded-xl p-4 sm:p-5" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)", boxShadow: "0 12px 30px -15px oklch(0.2 0.02 240 / 0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Tax invoice</div>
              <div className="lp-num text-[13px] font-semibold">INV-00248</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Date</div>
              <div className="lp-num text-[11px]">04 Jul 2026</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>Billed to</div>
            <div className="text-[12px] font-semibold">Sundaram Steel Works</div>
            <div className="text-[10px] lp-num" style={{ color: "var(--lp-mute)" }}>GSTIN 33AABCS4123A1Z9</div>
          </div>
          <div className="mt-3 divide-y" style={{ borderColor: "var(--lp-line-2)" }}>
            {[
              ["MS Angle 50×50×5", "72161000", "10,920.00"],
              ["Fabrication labour", "998873", "18,500.00"],
              ["Red oxide primer", "998518", "3,200.00"],
            ].map(([d, h, a]) => (
              <div key={d} className="grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 text-[10.5px]">
                <span>{d}</span>
                <span className="lp-num px-2" style={{ color: "var(--lp-mute)" }}>{h}</span>
                <span className="lp-num">{a}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 flex items-center justify-between text-[12px] font-semibold" style={{ borderTop: "1px solid var(--lp-line)" }}>
            <span>Total</span>
            <span className="lp-num">₹ 38,491.60</span>
          </div>
          <div className="mt-3 rounded-md px-2 py-1 text-[9.5px] inline-flex items-center gap-1.5 lp-num" style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>
            ✓ Paid on WhatsApp · UPI · 4.2s
          </div>
        </div>
        {/* label */}
        <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-[0.22em] px-2 py-1 rounded-full lp-num" style={{ background: "var(--lp-brand-ink)", color: "white" }}>
          After · 30s
        </div>
      </div>

      {/* ── BEFORE (clipped to left of the handle) ── */}
      <div className="bas-top absolute inset-0 flex items-center justify-center p-6 sm:p-10" style={{ background: "oklch(0.97 0.005 90)" }}>
        {/* mock Excel-style mess */}
        <div className="w-full max-w-[520px] rounded-md" style={{ background: "var(--lp-paper)", border: "1px solid oklch(0.85 0.02 90)", boxShadow: "0 6px 15px -8px oklch(0.2 0.02 240 / 0.15)" }}>
          <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr] text-[9.5px] lp-num">
            {/* header */}
            <div className="col-span-5 grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr]" style={{ background: "oklch(0.94 0.005 90)", borderBottom: "1px solid oklch(0.85 0.02 90)" }}>
              {["", "A", "B", "C", "D"].map((l) => (
                <div key={l} className="px-1.5 py-1 text-center font-semibold" style={{ color: "var(--lp-mute)" }}>{l}</div>
              ))}
            </div>
            {[
              ["1", "Invoice", "48", "Sundaram", "38491"],
              ["2", "Date", "4/7/26", "gstin?", "??"],
              ["3", "Item 1", "ms angle", "42kg", "10920.00"],
              ["4", "Item 2", "labour", "1", "18500"],
              ["5", "Item 3", "paint", "1", "3200"],
              ["6", "Subtotal", "", "", "=SUM(D3:D5)"],
              ["7", "CGST 9%", "", "", "?"],
              ["8", "SGST 9%", "", "", "?"],
              ["9", "TOTAL", "", "", "#REF!"],
            ].map((row, i) => (
              <div key={i} className="col-span-5 grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr]" style={{ borderBottom: "1px solid oklch(0.92 0.005 90)" }}>
                <div className="px-1.5 py-1 text-center" style={{ background: "oklch(0.94 0.005 90)", color: "var(--lp-mute)" }}>{row[0]}</div>
                {row.slice(1).map((c, j) => (
                  <div key={j} className="px-2 py-1 truncate" style={{ color: c.includes("#REF") ? "var(--lp-pain)" : c === "?" || c === "??" ? "var(--lp-pain)" : "var(--lp-ink)" }}>
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.22em] px-2 py-1 rounded-full lp-num" style={{ background: "var(--lp-pain)", color: "white" }}>
          Before · 45m
        </div>
      </div>

      {/* Handle */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 w-[2px]"
        style={{ left: `${x}%`, background: "white", boxShadow: "0 0 0 1px oklch(0.2 0.02 240 / 0.2)" }}
      />
      <div
        aria-hidden
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold"
        style={{
          left: `${x}%`,
          background: "white",
          border: "1px solid var(--lp-line)",
          boxShadow: "0 6px 16px -4px oklch(0.2 0.02 240 / 0.3)",
          color: "var(--lp-ink)",
        }}
      >
        ⇔
      </div>

      {/* Actual input, sits on top full-width, transparent thumb */}
      <input
        type="range"
        min={4}
        max={96}
        value={x}
        onChange={(e) => setX(Number(e.target.value))}
        aria-label="Drag to compare old workflow vs QuoteGen"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
    </div>
  );
}
