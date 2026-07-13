"use client";

import { motion, useAnimationFrame, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, Clock, Zap, MessageSquare, ChevronRight, Sparkles } from "lucide-react";

/**
 * Chapter 03 — "Money, watched." (v2, outcome-focused, interactive)
 * A live-feeling console mirroring the /cash Command Center:
 *  · rotating outcome banner (why the user should care)
 *  · 4 tiles with count-up numbers + accent corners + Live pulse
 *  · AR bars with hover shimmer + ageing % share
 *  · AP with early-pay-discount hook
 *  · Net-position sparkline with hover tooltip per day
 *  · Cadence queue: rows expand on click to reveal message preview
 *    + predicted-recovery-% outcome line
 *  · "Just happened" scrolling ticker at the bottom
 * Fully responsive (2×2 desktop, single-col mobile).
 */

const EASE = [0.23, 1, 0.32, 1] as const;

/* ---------- data ---------- */

const AR = [
  { bucket: "0–30 days",  amount: 240000, tone: "#047857", clients: ["Ramesh Traders", "Kaveri Steel", "+6 more"] },
  { bucket: "30–60 days", amount: 120000, tone: "#059669", clients: ["Priya Fabricators", "+3 more"] },
  { bucket: "60–90 days", amount: 42000,  tone: "#B45309", clients: ["Vinod & Sons"] },
  { bucket: "90+ days",   amount: 18000,  tone: "#B91C1C", clients: ["Meera Metal"] },
];
const AR_TOTAL = 420000;

const AP = [
  { vendor: "Kaveri Steel Co.", ref: "Bill B-4412",  amt: 18400, days: 2 },
  { vendor: "Ravi Transport",   ref: "Bill T-118",   amt: 42800, days: 5 },
  { vendor: "Elite Packing",    ref: "Bill P-091",   amt: 32600, days: 7 },
  { vendor: "Salary batch",     ref: "Nov payroll",  amt: 16200, days: 3 },
];
const AP_TOTAL = 110000;

const CADENCE = [
  { client: "Ramesh Traders", overdue: 45, at: "6:00 pm today",  channel: "WhatsApp",   step: "Gentle nudge",   predict: 82 },
  { client: "Kaveri Steel",   overdue: 62, at: "Tomorrow 10 am", channel: "Email",      step: "Firm reminder",  predict: 68 },
  { client: "Meera Metal",    overdue: 91, at: "Friday",         channel: "Call sheet", step: "Escalation",     predict: 54 },
];

const SPARK = [280, 292, 268, 305, 341, 328, 391];
const SPARK_MIN = 260, SPARK_MAX = 400;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

const OUTCOMES: { Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; body: React.ReactNode }[] = [
  { Icon: TrendingUp, body: <><b>₹3.1L</b> stays with you tonight — netted, aged, and chased on its own.</> },
  { Icon: Zap,        body: <>3 follow-ups fire themselves — <b>zero reminders</b> on your phone.</> },
  { Icon: Sparkles,   body: <>Clear payables before <b>Friday</b>, keep <b>₹4,200</b> in early-pay discounts.</> },
];

const TICKER = [
  "₹62,092 UPI from Ramesh Traders — auto-reconciled",
  "Kaveri Steel · 62-day chase queued for 10 am tomorrow",
  "Bill B-4412 approved · queued in Friday NEFT batch",
  "Meera Metal · escalation letter drafted, awaiting review",
  "AR aged 30–60 dropped ₹18k this week",
  "Payslip for Ravi sent · WhatsApp delivered",
];

const fmtINR = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k`
  : `₹${n}`;

/* ---------- CountUp: animates 0 → target when scrolled into view ---------- */

function CountUp({ to, format, dur = 1.4, className = "" }: {
  to: number; format: (n: number) => string; dur?: number; className?: string;
}) {
  const [n, setN] = useState(0);
  const seen = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !seen.current) {
        seen.current = true;
        const start = performance.now();
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / (dur * 1000));
          setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(tick);
        };
        tick();
      }
    }, { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, [to, dur]);
  return <span ref={ref} className={className}>{format(n)}</span>;
}

/* ---------- root ---------- */

export default function CashConsole() {
  const [tick, setTick] = useState(0);
  const [hoveredAR, setHoveredAR] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const started = useRef<number | null>(null);

  useAnimationFrame((t) => {
    if (started.current == null) started.current = t;
    setTick((t - started.current) / 1000);
  });

  const outcomeIdx = Math.floor(tick / 3.6) % OUTCOMES.length;
  const cadenceActive = Math.floor(tick / 2.4) % CADENCE.length;

  return (
    <div>
      <OutcomeBand idx={outcomeIdx} />
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <ArTile hovered={hoveredAR} onHover={setHoveredAR} />
        <ApTile />
        <NetTile />
        <CadenceTile activeIdx={cadenceActive} expanded={expanded} onExpand={setExpanded} />
      </div>
      <Ticker />
    </div>
  );
}

/* ---------- outcome band ---------- */

function OutcomeBand({ idx }: { idx: number }) {
  const O = OUTCOMES[idx];
  return (
    <div className="relative rounded-2xl overflow-hidden px-4 sm:px-5 py-3.5"
         style={{
           background: "linear-gradient(90deg, #ECFDF5 0%, #EEF2FF 100%)",
           border: "1px solid var(--lp-line)",
         }}>
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#fff", border: "1px solid var(--lp-line-2)" }}>
          <O.Icon size={16} style={{ color: "#047857" }} />
        </span>
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.p key={idx}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-[13.5px] sm:text-[14.5px] leading-snug"
              style={{ color: "var(--lp-ink)" }}>
              {O.body}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex gap-1 shrink-0">
          {OUTCOMES.map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ background: i === idx ? "#047857" : "var(--lp-line)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- tile shell ---------- */

function TileShell({ accent, kicker, headNum, headText, headSub, live, children }: {
  accent: string; kicker: string;
  headNum?: number; headText?: string; headSub?: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 h-full relative overflow-hidden"
         style={{
           background: "var(--lp-paper)",
           border: "1px solid var(--lp-line)",
           boxShadow: "0 20px 60px -30px oklch(0.25 0.02 240 / 0.18)",
         }}>
      <div className="relative flex items-center gap-2">
        <span className="w-1 h-4 rounded-sm" style={{ background: accent }} />
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-bold" style={{ color: accent }}>
          {kicker}
        </span>
        {live && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--lp-mute)" }}>
            <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.6, repeat: Infinity }}
                         className="w-1.5 h-1.5 rounded-full" style={{ background: "#047857" }} />
            LIVE
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap relative">
        {headNum != null
          ? <CountUp to={headNum} format={fmtINR}
                     className="lp-num text-[24px] sm:text-[28px] font-bold leading-none" />
          : <span className="lp-num text-[24px] sm:text-[28px] font-bold leading-none">{headText}</span>}
        {headSub && <span className="text-[11px]" style={{ color: "var(--lp-mute)" }}>{headSub}</span>}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------- AR tile ---------- */

function ArTile({ hovered, onHover }: { hovered: number | null; onHover: (i: number | null) => void }) {
  const max = AR[0].amount;
  const stuck = AR[2].amount + AR[3].amount;
  return (
    <TileShell accent="#047857" kicker="Receivables · ageing" headNum={AR_TOTAL} headSub="owed to you" live>
      <div className="mt-4 space-y-2.5">
        {AR.map((row, i) => {
          const pct = (row.amount / max) * 100;
          const share = Math.round((row.amount / AR_TOTAL) * 100);
          const isHov = hovered === i;
          return (
            <div key={row.bucket}
                 onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}
                 onFocus={() => onHover(i)} tabIndex={0}
                 className="outline-none cursor-default">
              <div className="flex items-center justify-between text-[11.5px]">
                <span style={{ color: "var(--lp-ink-soft)" }}>{row.bucket}</span>
                <span className="flex items-center gap-1.5">
                  <span className="lp-num text-[10px]" style={{ color: "var(--lp-mute)" }}>{share}%</span>
                  <span className="lp-num font-semibold" style={{ color: row.tone }}>{fmtINR(row.amount)}</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--lp-canvas)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: EASE }}
                  className="h-full relative overflow-hidden"
                  style={{ background: `linear-gradient(90deg, ${row.tone}, ${row.tone}dd)` }}>
                  {isHov && (
                    <motion.span aria-hidden className="absolute inset-0"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 1.1, ease: "linear", repeat: Infinity }} />
                  )}
                </motion.div>
              </div>
              <motion.div initial={false} animate={{ height: isHov ? "auto" : 0, opacity: isHov ? 1 : 0 }}
                          transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                <p className="pt-1 text-[10.5px]" style={{ color: "var(--lp-mute)" }}>
                  {row.clients.join(" · ")}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
      <p className="mt-3.5 text-[11px] rounded-lg px-2.5 py-1.5"
         style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
        <span className="lp-num font-bold">{fmtINR(stuck)}</span> stuck past 60 days — cadence engine chasing tonight.
      </p>
    </TileShell>
  );
}

/* ---------- AP tile ---------- */

function ApTile() {
  return (
    <TileShell accent="#B45309" kicker="Payables · this week" headNum={AP_TOTAL} headSub="going out">
      <ul className="mt-4 space-y-1.5">
        {AP.map((row) => (
          <li key={row.vendor} className="flex items-center justify-between rounded-lg px-2.5 py-2"
              style={{ background: "var(--lp-canvas)", border: "1px solid var(--lp-line-2)" }}>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold truncate">{row.vendor}</p>
              <p className="text-[10.5px]" style={{ color: "var(--lp-mute)" }}>{row.ref}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="lp-num text-[12.5px] font-bold">{fmtINR(row.amt)}</p>
              <p className="text-[10px] inline-flex items-center gap-0.5"
                 style={{ color: row.days <= 3 ? "#B91C1C" : "var(--lp-mute)" }}>
                <Clock size={9} /> in {row.days}d
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[11px] rounded-lg px-2.5 py-1.5"
         style={{ background: "#FEF3C7", color: "#78350F", border: "1px solid #FDE68A" }}>
        Clear all before <b>Friday</b> → early-pay discounts save <b>₹4,200</b>.
      </p>
    </TileShell>
  );
}

/* ---------- Net tile ---------- */

function NetTile() {
  const net = AR_TOTAL - AP_TOTAL;
  const delta = (SPARK[SPARK.length - 1] - SPARK[0]) * 1000;
  const pct = Math.round((delta / (SPARK[0] * 1000)) * 100);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const pathD = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * 100;
    const y = 100 - ((v - SPARK_MIN) / (SPARK_MAX - SPARK_MIN)) * 100;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <TileShell accent="#4338CA" kicker="Net position · today" headNum={net} headSub="AR − AP" live>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: "#ECFDF5", color: "#047857" }}>
          <TrendingUp size={11} /> +{fmtINR(delta)}
        </span>
        <span className="text-[11px]" style={{ color: "var(--lp-mute)" }}>
          <span className="lp-num font-semibold" style={{ color: "#047857" }}>+{pct}%</span> vs last week
        </span>
      </div>
      <div className="mt-3 relative h-20 sm:h-24 select-none"
           onMouseLeave={() => setHoverX(null)}
           onMouseMove={(e) => {
             const r = e.currentTarget.getBoundingClientRect();
             const p = (e.clientX - r.left) / r.width;
             const i = Math.round(p * (SPARK.length - 1));
             setHoverX(Math.max(0, Math.min(SPARK.length - 1, i)));
           }}>
        {/* subtle Y baseline gridlines */}
        <div aria-hidden className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          <span className="h-px w-full" style={{ background: "var(--lp-line-2)" }} />
          <span className="h-px w-full" style={{ background: "var(--lp-line-2)" }} />
          <span className="h-px w-full" style={{ background: "var(--lp-line-2)" }} />
        </div>
        {/* min/max labels on Y axis */}
        <span className="absolute -left-0.5 top-0 text-[9px] lp-num" style={{ color: "var(--lp-mute)" }}>
          {fmtINR(SPARK_MAX * 1000)}
        </span>
        <span className="absolute -left-0.5 bottom-0 text-[9px] lp-num" style={{ color: "var(--lp-mute)" }}>
          {fmtINR(SPARK_MIN * 1000)}
        </span>
        {/* stretched path */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full block">
          <defs>
            <linearGradient id="cc-net-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4338CA" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#4338CA" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path d={`${pathD} L100,100 L0,100 Z`} fill="url(#cc-net-fill)" stroke="none"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4, ease: EASE }} />
          <motion.path d={pathD} fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }} />
        </svg>
        {/* Round dots — HTML overlay so aspect-ratio distortion doesn't ovalize them */}
        {SPARK.map((v, i) => {
          const x = (i / (SPARK.length - 1)) * 100;
          const y = 100 - ((v - SPARK_MIN) / (SPARK_MAX - SPARK_MIN)) * 100;
          const isLast = i === SPARK.length - 1;
          const isHov = hoverX === i;
          const size = isLast || isHov ? 9 : 5;
          return (
            <span key={i} aria-hidden
              className="absolute rounded-full pointer-events-none transition-all duration-200"
              style={{
                left: `${x}%`, top: `${y}%`,
                width: size, height: size,
                transform: "translate(-50%, -50%)",
                background: isLast || isHov ? "#4338CA" : "#fff",
                border: `1.5px solid #4338CA`,
                boxShadow: isLast ? "0 0 0 4px oklch(0.85 0.13 275 / 0.28)" : "none",
              }} />
          );
        })}
        {/* hover crosshair + tooltip */}
        {hoverX != null && (
          <>
            <span aria-hidden className="absolute top-0 bottom-0 w-px pointer-events-none"
                  style={{
                    left: `${(hoverX / (SPARK.length - 1)) * 100}%`,
                    background: "linear-gradient(180deg, transparent, #4338CA88, transparent)",
                  }} />
            <div className="absolute pointer-events-none text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap z-10"
                 style={{
                   left: `${(hoverX / (SPARK.length - 1)) * 100}%`,
                   top: -6,
                   transform: `translate(-50%, -100%)`,
                   background: "var(--lp-ink)", color: "#fff",
                   boxShadow: "0 4px 12px -4px rgba(0,0,0,0.3)",
                 }}>
              {DAY_LABELS[hoverX]} · {fmtINR(SPARK[hoverX] * 1000)}
            </div>
          </>
        )}
      </div>
      {/* Day labels — absolute-positioned to align with dots */}
      <div className="relative mt-2 h-3.5">
        {DAY_LABELS.map((d, i) => {
          const x = (i / (DAY_LABELS.length - 1)) * 100;
          const isLast = i === DAY_LABELS.length - 1;
          return (
            <span key={d}
              className="absolute top-0 text-[10px] lp-num whitespace-nowrap"
              style={{
                left: `${x}%`,
                transform: "translateX(-50%)",
                color: isLast ? "var(--lp-brand-ink)" : "var(--lp-mute)",
                fontWeight: isLast ? 700 : 400,
              }}>
              {d}
            </span>
          );
        })}
      </div>
    </TileShell>
  );
}

/* ---------- Cadence tile ---------- */

function CadenceTile({ activeIdx, expanded, onExpand }: {
  activeIdx: number; expanded: number | null; onExpand: (i: number | null) => void;
}) {
  return (
    <TileShell accent="#B91C1C" kicker="Auto follow-ups · queue" headText="Next 3 chases" headSub="fully automated" live>
      <ul className="mt-4 space-y-2">
        {CADENCE.map((c, i) => {
          const active = i === activeIdx;
          const hot = c.overdue > 60;
          const open = expanded === i;
          return (
            <motion.li key={c.client}
              animate={{
                background: active ? "#FEF2F2" : "var(--lp-canvas)",
                borderColor: active ? "#FCA5A5" : "var(--lp-line-2)",
              }}
              transition={{ duration: 0.4, ease: EASE }}
              className="rounded-lg border overflow-hidden">
              <button type="button" onClick={() => onExpand(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-start justify-between gap-2 px-2.5 py-2 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold">{c.client}</span>
                    <span className="lp-num text-[10px] font-bold rounded px-1.5 py-0.5"
                          style={{ background: hot ? "#FEE2E2" : "#FEF3C7",
                                   color:      hot ? "#B91C1C" : "#B45309" }}>
                      {c.overdue}d
                    </span>
                  </div>
                  <p className="text-[10.5px] mt-0.5" style={{ color: "var(--lp-mute)" }}>
                    {c.step} · via {c.channel}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10.5px] whitespace-nowrap"
                     style={{ color: active ? "#B91C1C" : "var(--lp-ink-soft)" }}>
                  {active && (
                    <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                                 className="w-1.5 h-1.5 rounded-full inline-block"
                                 style={{ background: "#B91C1C" }} />
                  )}
                  <Clock size={10} /> {c.at}
                  <ChevronRight size={11} className="transition-transform"
                                style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
                </div>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div key="p"
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden">
                    <div className="px-2.5 pb-2.5">
                      <div className="rounded-md p-2 text-[11px] leading-snug"
                           style={{ background: "#fff", border: "1px solid var(--lp-line-2)" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare size={11}
                                         style={{ color: c.channel === "WhatsApp" ? "#22C55E" : c.channel === "Email" ? "#0369A1" : "#B45309" }} />
                          <span className="text-[9.5px] uppercase tracking-widest font-bold"
                                style={{ color: "var(--lp-mute)" }}>
                            Preview · {c.channel}
                          </span>
                        </div>
                        <p style={{ color: "var(--lp-ink-soft)" }}>
                          Hi {c.client.split(" ")[0]}, gentle reminder — invoice from {c.overdue} days ago is still open. Reply <b>PAID</b> once cleared and we&apos;ll close it out.
                        </p>
                      </div>
                      <p className="mt-1.5 text-[10.5px]" style={{ color: "#065F46" }}>
                        <b>Predicted:</b> {c.predict}% of {c.overdue}-day chases clear within 72h at this step.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </TileShell>
  );
}

/* ---------- ticker ---------- */

function Ticker() {
  return (
    <div className="mt-4 relative rounded-2xl overflow-hidden"
         style={{ background: "var(--lp-ink)", border: "1px solid var(--lp-line)" }}>
      <div className="flex items-center h-10">
        <span className="shrink-0 flex items-center gap-1.5 px-3 h-full text-[10.5px] uppercase tracking-widest font-bold"
              style={{ background: "#047857", color: "#fff" }}>
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}
                       className="w-1.5 h-1.5 rounded-full bg-white" />
          Just happened
        </span>
        <div className="relative flex-1 overflow-hidden h-full">
          <motion.div className="absolute top-0 flex items-center h-full whitespace-nowrap gap-10 pl-6"
                      animate={{ x: ["0%", "-50%"] }}
                      transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="text-[12px] flex items-center gap-2"
                    style={{ color: "oklch(0.85 0.02 240)" }}>
                <span style={{ color: "#34D399" }}>●</span>{t}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
