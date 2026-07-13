"use client";

import { motion } from "motion/react";
import { BarChart3, Briefcase, Coins, FileSpreadsheet, Receipt, TrendingUp } from "lucide-react";

/**
 * Product collage — 5 real-QuoteGen screens fanned out, floating gently.
 * Says "one workspace for the whole business" in one image.
 *
 * Every panel below references a real page in the app:
 *   Invoice          → /invoices (real fields, HSN, GST split)
 *   Cash             → /cash    (real KPIs Money In / Out / Net + aging buckets)
 *   Payroll          → /salary  (real components PF/ESI/PT/Net)
 *   GST Return       → /gst-report (B2B / B2CS / Nil breakdown)
 *   Sales Pipeline   → /pipeline (stage counters)
 */
export default function HeroCollage() {
  return (
    <div className="relative w-full aspect-[5/4] max-w-[620px] mx-auto">
      {/* Ambient wash */}
      <div
        className="absolute inset-6 rounded-[36px]"
        style={{
          background: "radial-gradient(60% 60% at 50% 40%, oklch(0.93 0.06 275 / 0.55), transparent 70%)",
          filter: "blur(6px)",
        }}
        aria-hidden
      />

      {/* Panel wrapper — each panel is a mini real-app screen */}
      {/* Invoice (center-back, largest) */}
      <FloatPanel
        style={{ top: "8%", left: "18%", width: "62%", zIndex: 3, transform: "rotate(-2deg)" }}
        delay={0.2}
      >
        <PanelHead icon={Receipt} title="Invoice · INV-00248" status="Paid" tone="brand" />
        <div className="p-4">
          <div className="flex items-start justify-between text-[10.5px]">
            <div>
              <div className="uppercase tracking-widest text-[8.5px]" style={{ color: "var(--lp-mute)" }}>Billed to</div>
              <div className="font-semibold mt-0.5">Sundaram Steel Works</div>
              <div className="lp-num text-[9px]" style={{ color: "var(--lp-mute)" }}>GSTIN 33AABCS4123A1Z9</div>
            </div>
            <div className="text-right">
              <div className="uppercase tracking-widest text-[8.5px]" style={{ color: "var(--lp-mute)" }}>Total</div>
              <div className="lp-num text-[14px] font-semibold" style={{ color: "var(--lp-brand-ink)" }}>₹ 38,491.60</div>
            </div>
          </div>
          <div className="mt-2 space-y-[3px]">
            {[
              ["MS Angle 50×50×5",   "72161000", "10,920"],
              ["Fabrication labour", "998873",   "18,500"],
              ["Red oxide primer",   "998518",    "3,200"],
            ].map(([d, h, a]) => (
              <div key={d} className="grid grid-cols-[1fr_auto_auto] text-[9.5px] py-0.5" style={{ borderBottom: "1px solid var(--lp-line-2)" }}>
                <span>{d}</span>
                <span className="lp-num px-2" style={{ color: "var(--lp-mute)" }}>{h}</span>
                <span className="lp-num">{a}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[8.5px] uppercase tracking-widest inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>
            ✓ CGST + SGST auto-split
          </div>
        </div>
      </FloatPanel>

      {/* Cash Command Center (top-right) */}
      <FloatPanel
        style={{ top: "0%", right: "0%", width: "36%", zIndex: 4, transform: "rotate(4deg)" }}
        delay={0.35}
      >
        <PanelHead icon={Coins} title="Cash Command Center" status="Live" tone="brand" />
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { l: "In",  v: "8.4L",  c: "var(--lp-brand-ink)" },
              { l: "Out", v: "3.2L",  c: "oklch(0.55 0.13 55)" },
              { l: "Net", v: "5.2L",  c: "var(--lp-ink)" },
            ].map((k) => (
              <div key={k.l} className="text-center rounded p-1" style={{ background: "var(--lp-line-2)" }}>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>{k.l}</div>
                <div className="lp-num text-[11px] font-semibold" style={{ color: k.c }}>₹{k.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-end gap-1 h-10">
            {[38, 52, 44, 65, 58, 78, 70, 92].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 7 ? "var(--lp-brand-ink)" : "var(--lp-brand-tint)" }} />
            ))}
          </div>
        </div>
      </FloatPanel>

      {/* Payroll slip (bottom-left) */}
      <FloatPanel
        style={{ bottom: "5%", left: "0%", width: "38%", zIndex: 4, transform: "rotate(-5deg)" }}
        delay={0.5}
      >
        <PanelHead icon={Briefcase} title="Payroll · July" status="Ready" tone="ink" />
        <div className="p-3 space-y-1 text-[10px]">
          {[
            ["Basic",     "40,000"],
            ["HRA",       "16,000"],
            ["PF 12%",     "4,800"],
            ["Prof tax",     "200"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span style={{ color: "var(--lp-ink-soft)" }}>{k}</span>
              <span className="lp-num">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5 mt-1 font-semibold text-[11px]" style={{ borderTop: "1px solid var(--lp-line)" }}>
            <span>Net</span>
            <span className="lp-num" style={{ color: "var(--lp-brand-ink)" }}>₹51,000</span>
          </div>
        </div>
      </FloatPanel>

      {/* GST Return (bottom-right) */}
      <FloatPanel
        style={{ bottom: "0%", right: "8%", width: "40%", zIndex: 5, transform: "rotate(3deg)" }}
        delay={0.65}
      >
        <PanelHead icon={FileSpreadsheet} title="GSTR-1 · Jun" status="Filed" tone="brand" />
        <div className="p-3 text-[10px] divide-y" style={{ borderColor: "var(--lp-line-2)" }}>
          {[
            ["B2B",       "12",  "3,84,910"],
            ["B2CS",      "27",  "1,20,300"],
            ["Nil rated",  "3",     "8,000"],
          ].map(([t, n, v]) => (
            <div key={t} className="grid grid-cols-3 py-1">
              <span>{t}</span>
              <span className="lp-num text-center" style={{ color: "var(--lp-mute)" }}>{n}</span>
              <span className="lp-num text-right">₹{v}</span>
            </div>
          ))}
        </div>
      </FloatPanel>

      {/* Sales pipeline (top-left, small chip) */}
      <FloatPanel
        style={{ top: "18%", left: "0%", width: "26%", zIndex: 2, transform: "rotate(-8deg)" }}
        delay={0.8}
      >
        <PanelHead icon={TrendingUp} title="Pipeline" />
        <div className="p-2 grid grid-cols-2 gap-1">
          {[
            { s: "Sent",  n:  8, c: "oklch(0.72 0.09 250)" },
            { s: "Won",   n:  4, c: "oklch(0.72 0.15 275)" },
            { s: "Draft", n: 12, c: "oklch(0.75 0.05 240)" },
            { s: "Lost",  n:  2, c: "oklch(0.60 0.14  20)" },
          ].map((c) => (
            <div key={c.s} className="rounded text-center py-1" style={{ background: `${c.c}22` }}>
              <div className="lp-num text-[12px] font-semibold" style={{ color: c.c }}>{c.n}</div>
              <div className="text-[8.5px]" style={{ color: "var(--lp-mute)" }}>{c.s}</div>
            </div>
          ))}
        </div>
      </FloatPanel>

      {/* Reports chip (right-middle, minimal) */}
      <FloatPanel
        style={{ top: "44%", right: "0%", width: "22%", zIndex: 2, transform: "rotate(7deg)" }}
        delay={0.95}
      >
        <PanelHead icon={BarChart3} title="Report" />
        <div className="p-2 pt-1">
          <svg viewBox="0 0 100 32" className="w-full">
            <polyline points="0,28 15,22 30,25 45,14 60,18 75,8 100,4" fill="none" stroke="var(--lp-brand-ink)" strokeWidth="1.6" />
          </svg>
          <div className="text-[9px] mt-1 lp-num" style={{ color: "var(--lp-brand-ink)" }}>+18.4% MoM</div>
        </div>
      </FloatPanel>
    </div>
  );
}

/* ─── panel building blocks ─── */

function FloatPanel({
  children, style, delay,
}: { children: React.ReactNode; style: React.CSSProperties; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
      className="absolute rounded-[14px] overflow-hidden"
      style={{
        ...style,
        background: "var(--lp-paper)",
        border: "1px solid var(--lp-line)",
        boxShadow: "0 30px 60px -30px oklch(0.2 0.02 240 / 0.35), 0 6px 20px -8px oklch(0.2 0.02 240 / 0.15)",
      }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5 + delay * 3, repeat: Infinity, ease: [0.45, 0, 0.55, 1], delay }}
        style={{ willChange: "transform" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function PanelHead({
  icon: Icon, title, status, tone,
}: { icon: React.ElementType; title: string; status?: string; tone?: "brand" | "ink" }) {
  return (
    <div className="flex items-center justify-between px-2.5 h-6.5 py-1" style={{ borderBottom: "1px solid var(--lp-line)", background: "color-mix(in oklch, var(--lp-paper) 92%, var(--lp-line))" }}>
      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
        <Icon size={11} strokeWidth={1.9} style={{ color: "var(--lp-ink-soft)" }} />
        {title}
      </div>
      {status && (
        <span className="text-[7.5px] uppercase tracking-widest px-1.5 py-0.5 rounded lp-num"
              style={{
                background: tone === "brand" ? "var(--lp-brand-tint)" : "var(--lp-line-2)",
                color: tone === "brand" ? "var(--lp-brand-ink)" : "var(--lp-ink-soft)",
              }}>
          {status}
        </span>
      )}
    </div>
  );
}
