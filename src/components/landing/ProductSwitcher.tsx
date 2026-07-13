"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Coins, FileSpreadsheet, Receipt, Briefcase } from "lucide-react";

/**
 * User-controlled product tour. Four real modules:
 *  - Bills  (real /invoices status ladder)
 *  - Money  (real /cash KPIs)
 *  - People (real /salary payslip)
 *  - GST    (real /gst-report summary)
 *
 * Copy stays short. The image does the talking.
 */
const TABS = [
  { key: "bills",  label: "Bills",  icon: Receipt,         h: "One tap. One bill.",         s: "Draft, tax split, HSN, receipt — done." },
  { key: "money",  label: "Money",  icon: Coins,           h: "See the cash. Every day.",    s: "Money in, money out, aging. On the home screen." },
  { key: "people", label: "People", icon: Briefcase,       h: "Pay the team. On time.",      s: "Salary, PF, TDS, F&F — one run." },
  { key: "gst",    label: "GST",    icon: FileSpreadsheet, h: "Ready when the CA asks.",     s: "GSTR-1 and 3B, one click." },
] as const;

type Key = typeof TABS[number]["key"];

export default function ProductSwitcher() {
  const [key, setKey] = useState<Key>("bills");
  const tab = TABS.find((t) => t.key === key)!;

  return (
    <div>
      {/* Tab strip */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => {
          const active = t.key === key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setKey(t.key)}
              className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-transform active:scale-[0.97]"
              style={{
                background: active ? "var(--lp-ink)" : "transparent",
                color: active ? "white" : "var(--lp-ink)",
                border: `1px solid ${active ? "var(--lp-ink)" : "var(--lp-line)"}`,
              }}
            >
              <t.icon size={13} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content — 2-column, big screen right, minimal copy left */}
      <div className="mt-8 grid lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] gap-8 items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.key + "-copy"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          >
            <h3 className="font-semibold leading-[1] text-[2rem] sm:text-[2.6rem]" style={{ letterSpacing: "-0.03em" }}>
              {tab.h}
            </h3>
            <p className="mt-3 text-[14.5px] max-w-[36ch]" style={{ color: "var(--lp-ink-soft)" }}>
              {tab.s}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="relative w-full aspect-[16/10]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.key + "-panel"}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                background: "var(--lp-paper)",
                border: "1px solid var(--lp-line)",
                boxShadow: "0 30px 60px -20px oklch(0.2 0.02 240 / 0.2)",
              }}
            >
              {key === "bills"  && <BillsPanel />}
              {key === "money"  && <MoneyPanel />}
              {key === "people" && <PeoplePanel />}
              {key === "gst"    && <GstPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── real-app panels ─────────────────────────────────────── */

function ChromeBar({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-3 h-7 text-[10.5px]" style={{ borderBottom: "1px solid var(--lp-line)", color: "var(--lp-mute)" }}>
      <span className="lp-num">app.quotegen.in {label}</span>
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.85 0.02 20)" }} />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.88 0.06 75)" }} />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.75 0.13 275)" }} />
      </span>
    </div>
  );
}

function BillsPanel() {
  return (
    <div className="w-full h-full flex flex-col">
      <ChromeBar label="/ invoices" />
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[15px] font-semibold">Invoices</h4>
          <span className="text-[10.5px] lp-num" style={{ color: "var(--lp-mute)" }}>128 total · ₹42.3L billed</span>
        </div>
        <div className="mt-3 divide-y" style={{ borderColor: "var(--lp-line-2)" }}>
          {[
            { n: "INV-00248", c: "Sundaram Steel Works",   a: "38,491.60", s: "Paid",    st: "var(--lp-brand-ink)" },
            { n: "INV-00247", c: "Bharat Print Works",     a: "12,600.00", s: "Unpaid",  st: "oklch(0.55 0.13 55)" },
            { n: "INV-00246", c: "Sathya Salon",           a:  "4,720.00", s: "Paid",    st: "var(--lp-brand-ink)" },
            { n: "INV-00245", c: "Example Studio",      a: "84,000.00", s: "Overdue", st: "oklch(0.55 0.17 20)" },
            { n: "INV-00244", c: "Kumar Textiles",         a:  "6,240.00", s: "Draft",   st: "var(--lp-mute)" },
          ].map((r) => (
            <div key={r.n} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2 text-[12px]">
              <span className="lp-num" style={{ color: "var(--lp-mute)" }}>{r.n}</span>
              <span>{r.c}</span>
              <span className="lp-num">₹ {r.a}</span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: `${r.st}18`, color: r.st }}>{r.s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoneyPanel() {
  return (
    <div className="w-full h-full flex flex-col">
      <ChromeBar label="/ cash" />
      <div className="flex-1 p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "Money in",  v: "₹ 8,42,600", s: "Open receivables", c: "var(--lp-brand-ink)" },
            { l: "Money out", v: "₹ 3,17,200", s: "Vendor bills",     c: "oklch(0.55 0.13 55)" },
            { l: "Net",       v: "₹ 5,25,400", s: "This month",       c: "var(--lp-ink)" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg p-3" style={{ background: "var(--lp-line-2)" }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>{k.l}</div>
              <div className="lp-num text-[18px] font-semibold mt-0.5" style={{ color: k.c }}>{k.v}</div>
              <div className="text-[10.5px] mt-0.5" style={{ color: "var(--lp-mute)" }}>{k.s}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="text-[10.5px] uppercase tracking-widest mb-2" style={{ color: "var(--lp-mute)" }}>Ageing</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { k: "Current", v: "3,20,400", pct: 40 },
              { k: "30d",     v: "2,60,000", pct: 32 },
              { k: "60d",     v: "1,42,200", pct: 18 },
              { k: "90+",     v:   "80,000", pct: 10 },
            ].map((b, i) => (
              <div key={b.k} className="rounded-lg p-2" style={{ background: "var(--lp-line-2)" }}>
                <div className="text-[10px]" style={{ color: "var(--lp-mute)" }}>{b.k}</div>
                <div className="lp-num text-[12px] font-semibold mt-0.5">₹ {b.v}</div>
                <div className="h-1 rounded-full mt-1.5" style={{ background: `linear-gradient(to right, ${i >= 2 ? "oklch(0.65 0.13 55)" : "var(--lp-brand-ink)"} ${b.pct * 2.5}%, oklch(0.9 0.005 240) 0)` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeoplePanel() {
  return (
    <div className="w-full h-full flex flex-col">
      <ChromeBar label="/ salary" />
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[15px] font-semibold">Salary · July 2026</h4>
          <span className="text-[10.5px] lp-num" style={{ color: "var(--lp-mute)" }}>12 employees · ₹ 8.4L total</span>
        </div>
        <div className="mt-3 divide-y" style={{ borderColor: "var(--lp-line-2)" }}>
          {[
            { n: "R. Priya (name changed)", r: "Design lead",   b: "60,000", pf: "7,200", n2: "68,000" },
            { n: "Karthik R.",            r: "Engineer",      b: "55,000", pf: "6,600", n2: "62,300" },
            { n: "Meera Iyer",            r: "Ops manager",   b: "48,000", pf: "5,760", n2: "54,500" },
            { n: "Vignesh S.",            r: "Sales exec",    b: "35,000", pf: "4,200", n2: "39,800" },
          ].map((e) => (
            <div key={e.n} className="grid grid-cols-[1.4fr_0.8fr_auto_auto_auto] items-center gap-3 py-2 text-[11.5px]">
              <span className="font-medium">{e.n}</span>
              <span style={{ color: "var(--lp-mute)" }}>{e.r}</span>
              <span className="lp-num text-right" style={{ color: "var(--lp-ink-soft)" }}>{e.b}</span>
              <span className="lp-num text-right" style={{ color: "var(--lp-mute)" }}>PF {e.pf}</span>
              <span className="lp-num text-right font-semibold" style={{ color: "var(--lp-brand-ink)" }}>₹{e.n2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GstPanel() {
  return (
    <div className="w-full h-full flex flex-col">
      <ChromeBar label="/ gst-report" />
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[15px] font-semibold">GSTR-1 · June 2026</h4>
          <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded" style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>Ready to file</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] text-[10px] uppercase tracking-widest pb-1.5" style={{ color: "var(--lp-mute)", borderBottom: "1px solid var(--lp-line)" }}>
          <span>Section</span><span className="text-right px-3">Docs</span><span className="text-right px-3">Taxable</span><span className="text-right">Tax</span>
        </div>
        {[
          ["B2B invoices",     "12", "3,84,910", "58,691"],
          ["B2C (Small)",       "27", "1,20,300", "18,354"],
          ["Credit notes",       "1",   "8,000",  "1,220"],
          ["Nil rated / exempt", "3",   "8,000",      "0"],
        ].map(([s, d, t, x]) => (
          <div key={s} className="grid grid-cols-[1fr_auto_auto_auto] py-1.5 text-[12px]" style={{ borderBottom: "1px solid var(--lp-line-2)" }}>
            <span>{s}</span>
            <span className="lp-num text-right px-3" style={{ color: "var(--lp-mute)" }}>{d}</span>
            <span className="lp-num text-right px-3">₹ {t}</span>
            <span className="lp-num text-right" style={{ color: "var(--lp-brand-ink)" }}>₹ {x}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
