"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Check, Lock, MessageCircle, PenLine, ChevronDown } from "lucide-react";

/**
 * Chapter 05 — "You stay in charge." Calm proof, 3 panels on dark bg:
 *  1. Permission matrix — who touches what
 *  2. Approval trail — how consent flowed (one real invoice)
 *  3. Audit diff — what changed, by whom, revertable
 * Light-touch interactivity only (hover + one expand) — this chapter is a
 * breather after two motion-heavy sections (Day timeline, Cash console).
 */
const EASE = [0.23, 1, 0.32, 1] as const;
const ACCENT = "oklch(0.85 0.13 275)";
const PANEL_BG = "oklch(0.28 0.02 240)";
const PANEL_LINE = "oklch(0.34 0.02 240)";
const SOFT = "oklch(0.72 0.02 240)";

const ROLES = [
  { name: "You",   role: "Owner",     access: [1,1,1,1,1,1] },
  { name: "Priya", role: "Accountant",access: [1,1,1,0,1,0] },
  { name: "Ravi",  role: "Sales",     access: [1,0,0,0,0,0] },
  { name: "Staff", role: "Dispatch",  access: [0,0,0,1,0,0] },
];
const MODULES = ["Quotes", "Invoices", "Cash", "Delivery", "GST", "Payroll"];

const TRAIL = [
  { who: "Ravi",  action: "Drafted invoice INV-0892", at: "10:04 am" },
  { who: "Priya", action: "Reviewed line items & GST split", at: "10:22 am" },
  { who: "You",   action: "Approved & e-signed — WhatsApp ping woke you", at: "11:15 am" },
];

export default function OwnerLedger() {
  const [hoverRole, setHoverRole] = useState<number | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  return (
    <div className="mt-10 grid lg:grid-cols-3 gap-4">
      {/* Panel 1 — Permission matrix */}
      <Panel title="Who touches what" icon={Lock}>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[11px] border-collapse min-w-[280px]">
            <thead>
              <tr>
                <th className="text-left font-normal pb-2" style={{ color: SOFT }} />
                {MODULES.map((m) => (
                  <th key={m} className="font-normal pb-2 px-1 text-center" style={{ color: SOFT }}>
                    <span className="block text-[9.5px] [writing-mode:vertical-lr] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">{m}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r, i) => (
                <tr key={r.name}
                    onMouseEnter={() => setHoverRole(i)} onMouseLeave={() => setHoverRole(null)}
                    className="transition-colors"
                    style={{ background: hoverRole === i ? "oklch(0.34 0.02 240 / 0.6)" : "transparent" }}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    <span className="text-white font-medium">{r.name}</span>
                    <span className="block text-[9.5px]" style={{ color: SOFT }}>{r.role}</span>
                  </td>
                  {r.access.map((a, j) => (
                    <td key={j} className="text-center py-1.5">
                      {a ? <Check size={12} className="inline" style={{ color: ACCENT }} /> : <span style={{ color: "oklch(0.4 0.02 240)" }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: SOFT }}>
          Roles, not spreadsheet trust. Each module locked per person.
        </p>
      </Panel>

      {/* Panel 2 — Approval trail */}
      <Panel title="How it got approved" icon={PenLine}>
        <div className="relative pl-4">
          <span aria-hidden className="absolute left-1 top-1 bottom-1 w-px" style={{ background: PANEL_LINE }} />
          <div className="space-y-3.5">
            {TRAIL.map((t, i) => (
              <motion.div key={t.at}
                initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.12, ease: EASE }}
                className="relative">
                <span aria-hidden className="absolute -left-4 top-1 w-2 h-2 rounded-full"
                      style={{ background: ACCENT, boxShadow: "0 0 0 3px oklch(0.28 0.02 240)" }} />
                <p className="text-[12.5px] leading-snug">
                  <span className="font-semibold text-white">{t.who}</span>
                  <span style={{ color: SOFT }}> — {t.action}</span>
                </p>
                <p className="lp-num text-[10px] mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>{t.at}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-1"
           style={{ background: "oklch(0.85 0.13 275 / 0.12)", color: ACCENT }}>
          <MessageCircle size={11} /> e-signature stamped on the PDF
        </p>
      </Panel>

      {/* Panel 3 — Audit diff */}
      <Panel title="What changed, and by whom" icon={ChevronDown}>
        <button type="button" onClick={() => setDiffOpen(v => !v)}
                className="w-full flex items-center justify-between text-left rounded-lg px-3 py-2.5"
                style={{ background: "oklch(0.24 0.02 240)", border: `1px solid ${PANEL_LINE}` }}>
          <div>
            <p className="text-[12px] text-white font-medium">Client GSTIN edited</p>
            <p className="text-[10.5px]" style={{ color: SOFT }}>Ramesh Traders · by Priya · 2:41 pm</p>
          </div>
          <motion.span animate={{ rotate: diffOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} style={{ color: SOFT }} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {diffOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
              <div className="mt-2 rounded-lg p-3 text-[11.5px] lp-num" style={{ background: "oklch(0.22 0.02 240)", border: `1px solid ${PANEL_LINE}` }}>
                <p className="flex items-center gap-2">
                  <span className="w-3 text-right" style={{ color: "#F87171" }}>−</span>
                  <span style={{ color: "#FCA5A5" }}>27AAAA1234A1Z5</span>
                </p>
                <p className="flex items-center gap-2 mt-1">
                  <span className="w-3 text-right" style={{ color: "#4ADE80" }}>+</span>
                  <span style={{ color: "#86EFAC" }}>24BBBB5678B2Z9</span>
                </p>
              </div>
              <button type="button" className="mt-2 text-[11px] font-semibold" style={{ color: ACCENT }}>
                Revert this change
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-3 text-[11px]" style={{ color: SOFT }}>
          Every field, every edit, timestamped. Nothing quietly disappears.
        </p>
      </Panel>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl p-5 h-full flex flex-col"
      style={{ background: PANEL_BG, border: `1px solid ${PANEL_LINE}` }}>
      <div className="flex items-center gap-2 mb-3.5">
        <Icon size={15} strokeWidth={1.8} style={{ color: ACCENT }} />
        <h3 className="text-[13.5px] font-semibold text-white">{title}</h3>
      </div>
      <div className="flex-1">{children}</div>
    </motion.div>
  );
}
