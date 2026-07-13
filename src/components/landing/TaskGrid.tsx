"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  FileText, ArrowRightCircle, MessageCircle, Landmark,
  Receipt, Wallet, Clock, ChevronDown,
} from "lucide-react";

/**
 * Chapter 06 — "The jobs you'll do here."
 * 6 tiles = the owner's actual recurring tasks, each tagged with a real
 * time/tap cost. Click a tile to expand its 3-step tap path. Flips the
 * page's narrative: everywhere else sells automation; this section proves
 * the owner's own remaining clicks are tiny too.
 */
const EASE = [0.23, 1, 0.32, 1] as const;

const TASKS = [
  { id: "quote",  Icon: FileText,        color: "#4338CA", t: "Raise a quote for a walk-in", badge: "3 taps", steps: ["Pick client (or add new)", "Add items from catalog", "Send — GST split done"] },
  { id: "convert",Icon: ArrowRightCircle,color: "#4338CA", t: "Convert quote → invoice",       badge: "1 tap",  steps: ["Open accepted quote", "Tap Convert", "Invoice + IRN generated"] },
  { id: "chase",  Icon: MessageCircle,   color: "#B91C1C", t: "Chase an overdue by WhatsApp",  badge: "2 taps", steps: ["Open Cash Command Center", "Tap the overdue row", "Reminder sent, logged"] },
  { id: "recon",  Icon: Landmark,        color: "#047857", t: "Reconcile a bank payment",      badge: "~20s",   steps: ["Payment appears in Cash", "Match to open invoice", "Status flips to Paid"] },
  { id: "bill",   Icon: Receipt,         color: "#9A3412", t: "Approve a vendor bill",          badge: "2 taps", steps: ["Open Procurement queue", "Check 3-way match", "Approve — queued to pay"] },
  { id: "payroll",Icon: Wallet,          color: "#0369A1", t: "Run October payroll",            badge: "1 run",  steps: ["Attendance auto-pulled", "Review PF/TDS", "Payslips sent to all"] },
];

export default function TaskGrid() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {TASKS.map((task) => {
        const isOpen = open === task.id;
        return (
          <motion.div key={task.id}
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, ease: EASE }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}
          >
            <button type="button" onClick={() => setOpen(isOpen ? null : task.id)}
                    aria-expanded={isOpen}
                    className="w-full text-left p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${task.color}18`, color: task.color }}>
                  <task.Icon size={17} strokeWidth={1.9} />
                </span>
                <span className="lp-num text-[10.5px] font-bold rounded-full px-2 py-1 shrink-0"
                      style={{ background: `${task.color}18`, color: task.color }}>
                  {task.badge}
                </span>
              </div>
              <p className="mt-3 text-[14.5px] font-semibold leading-snug" style={{ color: "var(--lp-ink)" }}>
                {task.t}
              </p>
              <div className="mt-2.5 flex items-center gap-1 text-[11.5px] font-semibold"
                   style={{ color: task.color }}>
                See the 3 taps
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={13} />
                </motion.span>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div key="steps"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden">
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0.5">
                    <ol className="space-y-2">
                      {task.steps.map((s, i) => (
                        <li key={s} className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--lp-ink-soft)" }}>
                          <span className="lp-num shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white"
                                style={{ background: task.color }}>
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      <p className="sm:col-span-2 lg:col-span-3 mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--lp-mute)" }}>
        <Clock size={12} /> Everything above the fold today, in under a minute a day.
      </p>
    </div>
  );
}
