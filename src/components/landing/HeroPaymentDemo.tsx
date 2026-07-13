"use client";

import { motion, useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Isolated leaf. Shows a real QuoteGen invoice (fields, HSN, GST split, HSN
 * summary, amount-in-words) transitioning through the actual status ladder
 * from `src/app/invoices/page.tsx` STATUSES: Draft → Unpaid → Paid.
 * Motion library: `motion` (framer-motion successor).
 */
const CYCLE = 6800; // ms — full loop before status resets
const PHASES = [
  { at: 0,     status: "Draft",  color: "#64748B" },
  { at: 1500,  status: "Unpaid", color: "#D97706" },
  { at: 4000,  status: "Paid",   color: "#059669" },
] as const;

export default function HeroPaymentDemo() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const startedAt = useRef<number | null>(null);

  useAnimationFrame((t) => {
    if (startedAt.current == null) startedAt.current = t;
    const elapsed = (t - startedAt.current) % CYCLE;
    const next = elapsed < PHASES[1].at ? 0 : elapsed < PHASES[2].at ? 1 : 2;
    if (next !== phase) setPhase(next);
  });

  const active = PHASES[phase];

  // Line items — real HSN codes, matching Kaveri Fabrication invoice pattern seen in earlier hero
  const lines = useMemo(
    () => [
      { d: "MS Angle 50×50×5, cut to length", hsn: "72161000", qty: "42 kg", amt: 10920 },
      { d: "Fabrication labour, on-site",     hsn: "998873",   qty: "1 lot",  amt: 18500 },
      { d: "Painting, red oxide primer",      hsn: "998518",   qty: "1 lot",  amt: 3200 },
    ],
    []
  );
  const subtotal = lines.reduce((s, l) => s + l.amt, 0);
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const total = subtotal + cgst + sgst;

  return (
    <div className="relative w-full max-w-[560px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "var(--lp-paper)",
          border: "1px solid var(--lp-line)",
          boxShadow: "0 40px 90px -30px oklch(0.25 0.02 240 / 0.28)",
        }}
      >
        {/* Real app chrome: mirrors the actual invoice detail page */}
        <div className="flex items-center justify-between px-4 h-11" style={{ borderBottom: "1px solid var(--lp-line)" }}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center lp-num text-[9.5px] font-bold text-white" style={{ background: "var(--lp-ink)" }}>QG</span>
            <span className="text-[12px] font-semibold">Invoices</span>
            <span className="text-[11px]" style={{ color: "var(--lp-mute)" }}>/ INV-00248</span>
          </div>
          <motion.span
            key={active.status}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="text-[10.5px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
            style={{ background: `${active.color}18`, color: active.color, border: `1px solid ${active.color}44` }}
          >
            {active.status}
          </motion.span>
        </div>

        {/* Doc body */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Tax Invoice</p>
              <p className="lp-num text-[15px] font-semibold mt-0.5">INV-00248</p>
              <p className="lp-num text-[10.5px] mt-1" style={{ color: "var(--lp-mute)" }}>Date · 04 Jul 2026 · Due 19 Jul 2026</p>
            </div>
            <div className="text-right">
              <p className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Billed to</p>
              <p className="text-[12px] font-semibold mt-0.5">Sundaram Steel Works</p>
              <p className="text-[10px]" style={{ color: "var(--lp-ink-soft)" }}>Ambattur, Chennai</p>
              <p className="lp-num text-[9.5px] mt-0.5" style={{ color: "var(--lp-mute)" }}>GSTIN 33AABCS4123A1Z9</p>
            </div>
          </div>

          {/* Line items */}
          <div className="mt-4">
            <div className="grid grid-cols-[1fr_auto_auto_auto] text-[9.5px] uppercase tracking-widest pb-2" style={{ color: "var(--lp-mute)", borderBottom: "1px solid var(--lp-line)" }}>
              <span>Description</span>
              <span className="text-right px-3">HSN</span>
              <span className="text-right px-3">Qty</span>
              <span className="text-right">Amount</span>
            </div>
            {lines.map((l, i) => (
              <motion.div
                key={l.d}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.15, ease: [0.23, 1, 0.32, 1] }}
                className="grid grid-cols-[1fr_auto_auto_auto] py-1.5 text-[11.5px]"
                style={{ borderBottom: "1px solid var(--lp-line-2)" }}
              >
                <span>{l.d}</span>
                <span className="text-right px-3 lp-num" style={{ color: "var(--lp-mute)" }}>{l.hsn}</span>
                <span className="text-right px-3 lp-num" style={{ color: "var(--lp-ink-soft)" }}>{l.qty}</span>
                <span className="text-right lp-num">{l.amt.toLocaleString("en-IN")}.00</span>
              </motion.div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="text-[10px] leading-relaxed" style={{ color: "var(--lp-mute)" }}>
              <p className="uppercase tracking-widest text-[9px]">Amount in words</p>
              <p className="mt-1 text-[10.5px]" style={{ color: "var(--lp-ink-soft)" }}>
                Rupees Thirty Eight Thousand Four Hundred Ninety One and Sixty Paise Only
              </p>
            </div>
            <div className="text-[11.5px] space-y-1">
              <div className="flex justify-between"><span style={{ color: "var(--lp-mute)" }}>Subtotal</span><span className="lp-num">{subtotal.toLocaleString("en-IN")}.00</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--lp-mute)" }}>CGST 9%</span><span className="lp-num">{cgst.toFixed(2)}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--lp-mute)" }}>SGST 9%</span><span className="lp-num">{sgst.toFixed(2)}</span></div>
              <div className="flex justify-between pt-1.5 text-[13px] font-semibold" style={{ borderTop: "1px solid var(--lp-line)" }}>
                <span>Total</span><span className="lp-num">₹ {total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contextual footer bar reflects the real action for each phase */}
        <motion.div
          key={active.status + "-bar"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center justify-between px-4 h-9 text-[11px]"
          style={{ background: `${active.color}12`, color: active.color, borderTop: `1px solid ${active.color}22` }}
        >
          <span className="inline-flex items-center gap-2 lp-num">
            {phase === 0 && <>✎ Auto-saving as draft</>}
            {phase === 1 && <>↗ Sent · Email + WhatsApp · 09:41</>}
            {phase === 2 && <>✓ Paid · UPI · Receipt PR-00317 issued</>}
          </span>
          <span className="lp-num">{phase === 0 ? "unsigned" : phase === 1 ? "awaiting payment" : "closed"}</span>
        </motion.div>
      </motion.div>

      {/* Floating payment-received tag appears at Paid phase */}
      {phase === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="absolute -left-4 sm:-left-6 -bottom-5 rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ background: "var(--lp-ink)", color: "white", boxShadow: "0 20px 40px -12px oklch(0.15 0.02 240 / 0.4)" }}
        >
          <span className="relative w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full" style={{ background: "oklch(0.75 0.15 275)" }} />
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: "oklch(0.75 0.15 275)" }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
          </span>
          <span className="text-[11.5px]">SBI · Credited <span className="lp-num">₹38,491.60</span></span>
        </motion.div>
      )}
    </div>
  );
}
