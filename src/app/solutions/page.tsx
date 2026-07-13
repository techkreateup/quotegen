"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import MarketingShell, { PageHero } from "@/components/landing/MarketingShell";

/* "Choose your need" — each solution maps real modules to a business type. */

const SOLUTIONS = [
  {
    id: "services", label: "Services & consulting",
    who: "Design studios · IT services · consultants · agencies",
    pain: "Quotes in Word, invoices in Excel, follow-ups in WhatsApp, GST at month-end panic.",
    flow: ["Quote the project", "Client accepts → invoice in one click", "Recurring invoices for retainers", "Payment reminders fire themselves", "GSTR-1/3B ready for your CA"],
    modules: ["Quotations", "Invoices", "Recurring billing", "Cash Command Center", "GST reports", "Projects"],
  },
  {
    id: "trading", label: "Traders & wholesalers",
    who: "Distributors · wholesalers · retail & kirana",
    pain: "Orders on calls, challans by hand, no idea which customer owes what since when.",
    flow: ["Sales Order from the client's PO", "Delivery Challan on dispatch", "Invoice with auto HSN summary", "Ageing buckets show who's late", "Debit/credit notes for returns"],
    modules: ["Sales Orders", "Delivery Challans", "Invoices", "Ageing & follow-ups", "Credit/Debit Notes", "Item catalog"],
  },
  {
    id: "manufacturing", label: "Manufacturing & contracting",
    who: "Manufacturers · fabricators · interior contractors",
    pain: "You buy materials and sell finished work — two paper trails, zero visibility, payment leaks.",
    flow: ["PO to your vendor", "GRN when material lands", "3-way match before you pay", "Quote → order → challan → invoice on the sales side", "One cash view across both"],
    modules: ["Purchase Orders", "Goods Receipts", "3-way match", "Vendor payments", "Full sales chain", "Payables ageing"],
  },
  {
    id: "team", label: "Businesses with staff",
    who: "Any business with 3+ employees",
    pain: "Salary calculations in Excel, PF/TDS guesswork, exits that take weeks to settle.",
    flow: ["Employee profile with CTC & statutory flags", "Monthly salary run computes everything", "Payslips generated per employee", "F&F settlement engine on exit", "Assets issued and recovered"],
    modules: ["Employees", "Salary runs", "Payslips", "F&F settlements", "Asset tracking", "Payment vouchers"],
  },
  {
    id: "owner", label: "Owners who want control",
    who: "Founders · directors · finance heads",
    pain: "Staff create documents you never see. Changes happen and nobody knows who made them.",
    flow: ["Roles decide who sees what", "Approvals gate quotes, invoices, POs, payroll", "Audit log records every change with before/after", "E-signatures stamp approved documents", "Recycle bin catches mistakes"],
    modules: ["Roles & permissions", "Approval workflows", "Audit log", "E-signatures", "Recycle bin", "Reports"],
  },
];

export default function SolutionsPage() {
  const [sel, setSel] = useState(SOLUTIONS[0]);
  return (
    <MarketingShell active="/solutions">
      <PageHero kicker="Solutions"
        title={<>What do you need<br /><span style={{ color: "var(--lp-brand-ink)" }}>to fix first?</span></>}
        sub="Pick the shape of your business. See the exact workflow QuoteGen runs for you — real modules, real screens, nothing hypothetical." />

      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-16">
        {/* selector */}
        <div className="flex flex-wrap gap-2">
          {SOLUTIONS.map((s) => (
            <button key={s.id} onClick={() => setSel(s)}
              className="rounded-full px-4 py-2 text-[13px] font-medium transition-all cursor-pointer"
              style={{
                background: sel.id === s.id ? "var(--lp-ink)" : "var(--lp-paper)",
                color: sel.id === s.id ? "white" : "var(--lp-ink)",
                border: `1px solid ${sel.id === s.id ? "var(--lp-ink)" : "var(--lp-line)"}`,
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={sel.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">

            {/* pain → flow */}
            <div className="rounded-2xl p-6 sm:p-8" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
              <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--lp-mute)" }}>{sel.who}</p>
              <div className="mt-4 rounded-xl p-4" style={{ background: "var(--lp-pain-tint)", border: "1px solid #FECACA" }}>
                <p className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: "var(--lp-pain)" }}>Today</p>
                <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--lp-ink)" }}>{sel.pain}</p>
              </div>
              <div className="mt-4">
                <p className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: "var(--lp-brand-ink)" }}>With QuoteGen</p>
                <ol className="mt-2 space-y-2.5">
                  {sel.flow.map((f, i) => (
                    <li key={i} className="grid grid-cols-[26px_1fr] gap-3 items-baseline text-[14px]">
                      <span className="lp-num text-[11px] font-semibold" style={{ color: "var(--lp-brand-ink)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ color: "var(--lp-ink)" }}>{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* modules used */}
            <div className="rounded-2xl p-6 sm:p-8 flex flex-col" style={{ background: "var(--lp-brand-tint)", border: "1px solid var(--lp-line)" }}>
              <p className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Modules doing the work</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {sel.modules.map((m) => (
                  <div key={m} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium"
                       style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line-2)" }}>
                    <Check size={13} strokeWidth={2.4} style={{ color: "var(--lp-brand-ink)" }} /> {m}
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[13px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>
                All included in every plan. No module add-on pricing, ever.
              </p>
              <Link href="/signup"
                    className="mt-auto pt-5 inline-flex items-center gap-2 text-[14px] font-semibold no-underline"
                    style={{ color: "var(--lp-brand-ink)" }}>
                Set this up in 3 minutes <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </MarketingShell>
  );
}
