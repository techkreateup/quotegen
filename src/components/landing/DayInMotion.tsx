"use client";

import { motion, useAnimationFrame, AnimatePresence } from "motion/react";
import { useMemo, useRef, useState } from "react";
import {
  FileText, Bell, ArrowRightCircle, FileCheck2,
  ShoppingCart, PackageCheck, CheckCircle2, Receipt,
  IndianRupee, AlertCircle, Wallet, TrendingUp,
  CalendarCheck, FileSignature,
  Truck, Percent, ShieldCheck, History,
} from "lucide-react";

/**
 * Chapter 02 — "Watch a Tuesday run itself."
 * Multi-lane horizontal timeline. Each of 5 modules (Sales, Procurement, Money,
 * People, Compliance) has its own rail with dots at event times. A playhead
 * sweeps left→right; as it crosses a dot, the dot fills and the newest global
 * event surfaces a floating label + populates the detail card below. Hover
 * pauses, click a dot to pin it. Fully responsive (5 lanes stay stacked, dot
 * grid shrinks — no chip-label overlap because labels appear one at a time).
 */

const EASE = [0.23, 1, 0.32, 1] as const;
const DAY_START = 8.5;
const DAY_END = 19;
const CYCLE_MS = 15000;

const LANES = [
  { key: "sales",  label: "Sales",       color: "#4338CA" },
  { key: "buy",    label: "Procurement", color: "#9A3412" },
  { key: "money",  label: "Money",       color: "#047857" },
  { key: "people", label: "People",      color: "#0369A1" },
  { key: "compl",  label: "Compliance",  color: "#B45309" },
] as const;

type LaneKey = typeof LANES[number]["key"];
type Ev = {
  id: string; lane: LaneKey; t: number;
  label: string; sub: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const EVENTS: Ev[] = [
  // Sales — order-to-cash
  { id: "s1", lane: "sales",  t: 9.3,  label: "Quote sent",        sub: "QT-0341 · ₹52,620 · Ramesh Traders",   Icon: FileText },
  { id: "s2", lane: "sales",  t: 11.2, label: "Reminder",          sub: "QT-0338 nudged via WhatsApp",           Icon: Bell },
  { id: "s3", lane: "sales",  t: 13.4, label: "→ Sales Order",     sub: "Client PO stitched to the chain",       Icon: ArrowRightCircle },
  { id: "s4", lane: "sales",  t: 15.7, label: "Invoice + IRN",     sub: "Signed in 3s · GST auto-split",         Icon: FileCheck2 },
  // Procurement — P2P
  { id: "b1", lane: "buy",    t: 9.8,  label: "PO issued",         sub: "PO-207 · Kaveri Steel · ₹18,400",       Icon: ShoppingCart },
  { id: "b2", lane: "buy",    t: 12.0, label: "GRN posted",        sub: "Full receipt · no shortage",             Icon: PackageCheck },
  { id: "b3", lane: "buy",    t: 14.2, label: "3-way match",       sub: "PO ↔ GRN ↔ Bill — clean",               Icon: CheckCircle2 },
  { id: "b4", lane: "buy",    t: 16.5, label: "Bill approved",     sub: "Queued for Friday payout",               Icon: Receipt },
  // Money — cash command center
  { id: "m1", lane: "money",  t: 10.4, label: "Payment in",        sub: "UPI · ₹62,092 · auto-reconciled",       Icon: IndianRupee },
  { id: "m2", lane: "money",  t: 12.6, label: "Overdue chased",    sub: "3 clients · 60+ days · pinged",         Icon: AlertCircle },
  { id: "m3", lane: "money",  t: 15.0, label: "Vendor payout",     sub: "NEFT batch · 4 bills cleared",           Icon: Wallet },
  { id: "m4", lane: "money",  t: 17.4, label: "Cash netted",       sub: "AR ₹4.2L − AP ₹1.1L = ₹3.1L",           Icon: TrendingUp },
  // People — HR/payroll
  { id: "p1", lane: "people", t: 9.6,  label: "Attendance",        sub: "11 present · 1 half-day",                Icon: CalendarCheck },
  { id: "p2", lane: "people", t: 12.3, label: "Leave OK",          sub: "Priya · 2 days · balance updated",       Icon: CheckCircle2 },
  { id: "p3", lane: "people", t: 15.2, label: "Payslip sent",      sub: "Ravi · Oct salary · WhatsApp",           Icon: FileSignature },
  // Compliance
  { id: "c1", lane: "compl",  t: 10.9, label: "e-Way bill",        sub: "Auto from delivery challan",             Icon: Truck },
  { id: "c2", lane: "compl",  t: 13.2, label: "TDS held",          sub: "₹1,840 held · challan queued",           Icon: Percent },
  { id: "c3", lane: "compl",  t: 15.6, label: "GSTR-1 row",        sub: "Ready to file Nov 11",                    Icon: ShieldCheck },
  { id: "c4", lane: "compl",  t: 17.7, label: "Audit stamped",     sub: "Who · what · when — logged",             Icon: History },
];

const xFor = (t: number) => ((t - DAY_START) / (DAY_END - DAY_START)) * 100;
const HOURS_LG = [9, 11, 13, 15, 17];
const HOURS_SM = [9, 12, 15, 18];
const fmt12 = (t: number, short = false) => {
  const h = Math.floor(t);
  const m = Math.round((t % 1) * 60);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return short
    ? `${h12}${ap[0]}`
    : `${h12}:${String(m).padStart(2, "0")} ${ap}`;
};

export default function DayInMotion() {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const offset = useRef(0);

  useAnimationFrame((t) => {
    if (paused) { startedAt.current = t - offset.current; return; }
    if (startedAt.current == null) startedAt.current = t;
    const elapsed = (t - startedAt.current) % CYCLE_MS;
    offset.current = elapsed;
    setProgress(elapsed / CYCLE_MS);
  });

  const currentTime = DAY_START + progress * (DAY_END - DAY_START);

  // Firing state: 'idle' (t > now), 'firing' (just crossed, <0.35h ago), 'done' (crossed earlier)
  const state = useMemo(() => {
    const s: Record<string, "idle" | "firing" | "done"> = {};
    for (const e of EVENTS) {
      if (e.t > currentTime) s[e.id] = "idle";
      else if (currentTime - e.t < 0.35) s[e.id] = "firing";
      else s[e.id] = "done";
    }
    return s;
  }, [currentTime]);

  // Globally-latest firing event → floating label + detail card
  const latest = useMemo(() => {
    const fired = EVENTS.filter(e => e.t <= currentTime);
    return fired.length ? fired[fired.length - 1] : null;
  }, [currentTime]);

  const tally = useMemo(() => {
    const done = EVENTS.filter(e => e.t <= currentTime);
    return {
      docs:    done.filter(e => ["s1","s3","s4","b1","p3"].includes(e.id)).length,
      cash:    done.filter(e => ["m1"].includes(e.id)).length * 62092,
      cleared: done.filter(e => ["b3","c3","c4"].includes(e.id)).length,
    };
  }, [currentTime]);

  const detailId = pinned ?? hover ?? latest?.id ?? null;
  const detail = detailId ? EVENTS.find(e => e.id === detailId) ?? null : null;
  const detailLane = detail ? LANES.find(l => l.key === detail.lane)! : null;

  return (
    <div
      className="relative mt-8 sm:mt-10 rounded-2xl overflow-hidden"
      style={{
        background: "var(--lp-paper)",
        border: "1px solid var(--lp-line)",
        boxShadow: "0 40px 90px -30px oklch(0.25 0.02 240 / 0.22)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); setHover(null); }}
    >
      {/* HEADER: live clock + tally */}
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-3 px-4 sm:px-6 py-2.5"
           style={{ borderBottom: "1px solid var(--lp-line-2)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: "#047857" }} />
          <span className="text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.16em] font-bold whitespace-nowrap"
                style={{ color: "var(--lp-ink-soft)" }}>
            Tuesday · Live
          </span>
          <span className="lp-num text-[12px] sm:text-[13px] font-bold ml-1" style={{ color: "var(--lp-brand-ink)" }}>
            {fmt12(currentTime)}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 lp-num text-[11px] sm:text-[11.5px]"
             style={{ color: "var(--lp-ink-soft)" }}>
          <Tally n={tally.docs} label="docs" color="#4338CA" />
          <Tally n={tally.cash} label="in" color="#047857" money />
          <Tally n={tally.cleared} label="cleared" color="#B45309" />
        </div>
      </div>

      {/* BODY */}
      <div className="px-4 sm:px-8 pt-8 pb-8">
        {/* time axis */}
        <div className="grid gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns: "84px 1fr" }}>
          <div />
          <div className="relative h-4">
            {/* desktop hours */}
            <div className="hidden sm:block absolute inset-0">
              {HOURS_LG.map((h) => (
                <span key={h} className="absolute top-0 lp-num text-[10px] -translate-x-1/2"
                      style={{ left: `${xFor(h)}%`, color: "var(--lp-mute)" }}>
                  {fmt12(h, true)}
                </span>
              ))}
            </div>
            {/* mobile hours */}
            <div className="sm:hidden absolute inset-0">
              {HOURS_SM.map((h) => (
                <span key={h} className="absolute top-0 lp-num text-[9.5px] -translate-x-1/2"
                      style={{ left: `${xFor(h)}%`, color: "var(--lp-mute)" }}>
                  {fmt12(h, true)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* lanes */}
        <div className="relative mt-2">
          {/* gridlines — over the timeline column only */}
          <div className="absolute inset-0 pointer-events-none grid gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns: "84px 1fr" }}>
            <div />
            <div className="relative">
              {HOURS_LG.map((h) => (
                <span key={h} aria-hidden className="absolute top-0 bottom-0 w-px"
                      style={{ left: `${xFor(h)}%`, background: "var(--lp-line-2)" }} />
              ))}
            </div>
          </div>

          {LANES.map((lane) => (
            <div key={lane.key} className="grid gap-x-2 sm:gap-x-3 items-center"
                 style={{ gridTemplateColumns: "84px 1fr", height: 68 }}>
              {/* lane label */}
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                <span className="w-1 h-4 rounded-sm shrink-0" style={{ background: lane.color }} />
                <span className="text-[10px] sm:text-[10.5px] uppercase tracking-[0.1em] font-bold truncate"
                      style={{ color: lane.color }}>
                  {lane.label}
                </span>
              </div>
              {/* rail + dots */}
              <div className="relative h-full">
                <span aria-hidden className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
                      style={{ background: "var(--lp-line-2)" }} />
                {EVENTS.filter(e => e.lane === lane.key).map((ev) => {
                  const st = state[ev.id];
                  const isFocus = detailId === ev.id;
                  const filled = st !== "idle";
                  const glow = st === "firing" || isFocus;
                  const x = xFor(ev.t);
                  const flip = x > 58;
                  return (
                    <button key={ev.id} type="button"
                      onMouseEnter={() => setHover(ev.id)}
                      onFocus={() => setHover(ev.id)}
                      onClick={() => setPinned(p => p === ev.id ? null : ev.id)}
                      aria-label={ev.label}
                      className="absolute top-1/2 -translate-y-1/2 outline-none"
                      style={{ left: `${x}%` }}
                    >
                      <motion.div
                        className="flex items-center gap-1 h-[22px] rounded-full px-2 whitespace-nowrap"
                        animate={{
                          scale: glow ? 1.06 : 1,
                          boxShadow: glow ? `0 0 0 3px ${lane.color}22, 0 6px 18px -6px ${lane.color}80` : "none",
                        }}
                        transition={{ duration: 0.25, ease: EASE }}
                        style={{
                          background: filled ? lane.color : "var(--lp-paper)",
                          color: filled ? "#fff" : lane.color,
                          border: `1px solid ${filled ? lane.color : lane.color + "55"}`,
                          transform: flip ? "translateX(calc(-100% + 2px))" : "translateX(-2px)",
                        }}
                      >
                        <ev.Icon size={11} strokeWidth={2.4} />
                        <span className="hidden md:inline text-[10.5px] font-semibold leading-none">{ev.label}</span>
                      </motion.div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* PLAYHEAD — spans lanes column only */}
          <div className="absolute top-0 bottom-0 pointer-events-none grid gap-x-2 sm:gap-x-3"
               style={{ gridTemplateColumns: "84px 1fr", left: 0, right: 0 }}>
            <div />
            <div className="relative">
              <div className="absolute top-0 bottom-0" style={{ left: `${progress * 100}%`, width: 1 }}>
                <div className="w-px h-full" style={{
                  background: "linear-gradient(180deg, transparent, var(--lp-brand-ink) 12%, var(--lp-brand-ink) 88%, transparent)",
                  boxShadow: "0 0 10px var(--lp-brand-ink)",
                }} />
                <div className="absolute -translate-x-1/2 -top-1 w-2 h-2 rounded-full"
                     style={{ background: "var(--lp-brand-ink)", boxShadow: "0 0 0 3px oklch(0.85 0.13 275 / 0.32)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* DETAIL CARD */}
        <div className="mt-4 min-h-[64px]">
          <AnimatePresence mode="wait">
            {detail && detailLane ? (
              <motion.div key={detail.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex items-start gap-3 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3"
                style={{ background: "var(--lp-canvas)", border: "1px solid var(--lp-line-2)" }}>
                <span className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${detailLane.color}18`, color: detailLane.color }}>
                  <detail.Icon size={16} strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="lp-num text-[11px] font-bold" style={{ color: detailLane.color }}>
                      {fmt12(detail.t)}
                    </span>
                    <span className="text-[10.5px] uppercase tracking-[0.1em] font-bold" style={{ color: detailLane.color }}>
                      {detailLane.label}
                    </span>
                    <span className="text-[13.5px] sm:text-[14px] font-semibold w-full sm:w-auto">{detail.label}</span>
                  </div>
                  <p className="text-[12px] sm:text-[12.5px] mt-0.5" style={{ color: "var(--lp-ink-soft)" }}>{detail.sub}</p>
                </div>
                {pinned && (
                  <button onClick={() => setPinned(null)}
                          className="text-[10.5px] font-semibold px-2 h-6 rounded-full shrink-0"
                          style={{ color: "var(--lp-mute)", background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
                    unpin
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.p key="hint"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[11.5px] sm:text-[12.5px] text-center pt-3"
                style={{ color: "var(--lp-mute)" }}>
                Hover to pause · Tap any dot to pin its details
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-6 py-2.5"
           style={{ borderTop: "1px solid var(--lp-line-2)", background: "var(--lp-canvas)" }}>
        <span className="text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] font-bold whitespace-nowrap"
              style={{ color: "var(--lp-mute)" }}>
          5 modules · one day
        </span>
        {LANES.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5 text-[11px]"
                style={{ color: "var(--lp-ink-soft)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tally({ n, label, color, money = false }: { n: number; label: string; color: string; money?: boolean }) {
  const display = money ? (n === 0 ? "₹0" : `₹${(n / 1000).toFixed(1)}k`) : String(n);
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <motion.span key={display}
        initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}
        className="font-bold" style={{ color }}>
        {display}
      </motion.span>
      <span style={{ color: "var(--lp-mute)" }}>{label}</span>
    </span>
  );
}
