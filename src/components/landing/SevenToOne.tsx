"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Looped "energy extraction" orbit: two dashed rings slowly rotate carrying the
 * nine places a business runs on today (line-icon + one-word label each). Every
 * platform continuously streams a pulse of energy down a wire into the central
 * QuoteGen core, which glows as it absorbs them. Autonomous, mobile-safe.
 */

type Tool = { k: string; name: string; color: string };

const TOOLS: Tool[] = [
  { k: "excel", name: "Excel", color: "#16A34A" },
  { k: "chat", name: "WhatsApp", color: "#22C55E" },
  { k: "book", name: "Notebook", color: "#D97706" },
  { k: "calc", name: "Calculator", color: "#4F46E5" },
  { k: "mail", name: "Email", color: "#2563EB" },
  { k: "phone", name: "Phone", color: "#7C3AED" },
  { k: "note", name: "Notes", color: "#CA8A04" },
  { k: "print", name: "Printer", color: "#475569" },
  { k: "folder", name: "Folders", color: "#EA580C" },
];

const N = TOOLS.length;
const SPIN = 120; // seconds per full platform revolution

function Icon({ k, s }: { k: string; s: number }) {
  const p = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (k) {
    case "excel": return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>;
    case "chat": return <svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" /></svg>;
    case "book": return <svg {...p}><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v18M11 8h5M11 12h5" /></svg>;
    case "calc": return <svg {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8" /><circle cx="9" cy="12" r=".6" fill="currentColor" /><circle cx="12" cy="12" r=".6" fill="currentColor" /><circle cx="15" cy="12" r=".6" fill="currentColor" /><circle cx="9" cy="16" r=".6" fill="currentColor" /><circle cx="12" cy="16" r=".6" fill="currentColor" /><circle cx="15" cy="16" r=".6" fill="currentColor" /></svg>;
    case "mail": return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    case "phone": return <svg {...p}><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>;
    case "note": return <svg {...p}><path d="M4 4h16v11l-5 5H4V4Z" /><path d="M15 20v-5h5" /></svg>;
    case "print": return <svg {...p}><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="7" rx="2" /><path d="M7 16h10v5H7z" /></svg>;
    default: return <svg {...p}><path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" /></svg>;
  }
}

export default function SevenToOne() {
  const reduce = useReducedMotion();
  // Must start false to match the SSR HTML (hydration would otherwise keep the
  // server's 520px style attribute forever); the mount effect flips it.
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const m = () => setMobile(window.innerWidth < 640);
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const size = mobile ? 320 : 520;
  const c = size / 2;
  const R = mobile ? 122 : 196;
  const bub = mobile ? 38 : 50;
  const spin = reduce ? {} : { rotate: 360 };
  const spinT = { duration: SPIN, repeat: Infinity, ease: "linear" as const };
  const antiT = { duration: SPIN, repeat: Infinity, ease: "linear" as const };

  const nodes = TOOLS.map((t, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return { ...t, i, x: c + Math.cos(a) * R, y: c + Math.sin(a) * R };
  });

  return (
    <div className="w-full flex justify-center mt-10">
      <div className="relative" style={{ width: size, height: size, maxWidth: "100%" }}>
        {/* decorative dashed rings (independent slow drift) */}
        <svg className="absolute inset-0" width={size} height={size} fill="none">
          <motion.g style={{ originX: "50%", originY: "50%" }} animate={reduce ? {} : { rotate: -360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }}>
            <circle cx={c} cy={c} r={R} stroke="var(--lp-line)" strokeWidth={1} strokeDasharray="3 10" />
          </motion.g>
        </svg>

        {/* ── rotating platform layer: wires + pulses + bubbles all share one spin ── */}
        <motion.div className="absolute inset-0" style={{ originX: "50%", originY: "50%" }} animate={spin} transition={spinT}>
          <svg className="absolute inset-0" width={size} height={size} fill="none">
            <defs>
              {nodes.map((n) => (
                <linearGradient key={n.i} id={`bm${n.i}`} gradientUnits="userSpaceOnUse" x1={n.x} y1={n.y} x2={c} y2={c}>
                  <stop offset="0" stopColor={n.color} stopOpacity="0" />
                  <stop offset="1" stopColor={n.color} stopOpacity="0.9" />
                </linearGradient>
              ))}
            </defs>
            {nodes.map((n) => (
              <g key={n.i}>
                <line x1={n.x} y1={n.y} x2={c} y2={c} stroke={`url(#bm${n.i})`} strokeWidth={1} strokeOpacity={0.25} />
                {!reduce && (
                  <>
                    <motion.circle r={mobile ? 2.4 : 3} fill={n.color}
                      initial={{ cx: n.x, cy: n.y, opacity: 0 }}
                      animate={{ cx: [n.x, c], cy: [n.y, c], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 1.8, delay: n.i * 0.32, repeat: Infinity, repeatDelay: N * 0.32 - 1.8, ease: "easeIn", times: [0, 0.1, 0.85, 1] }}
                      style={{ filter: `drop-shadow(0 0 5px ${n.color})` }} />
                    <motion.line x1={n.x} y1={n.y} x2={c} y2={c} stroke={n.color} strokeWidth={1.4} strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: [0, 1, 1], opacity: [0.5, 0.5, 0] }}
                      transition={{ duration: 1.8, delay: n.i * 0.32, repeat: Infinity, repeatDelay: N * 0.32 - 1.8, ease: "easeIn" }} />
                  </>
                )}
              </g>
            ))}
          </svg>

          {/* bubbles — counter-rotate content so icon + label stay upright */}
          {nodes.map((n) => (
            <div key={n.i} className="absolute" style={{ left: n.x, top: n.y, transform: "translate(-50%,-50%)" }}>
              <motion.div className="flex flex-col items-center" style={{ originX: "50%", originY: "50%" }} animate={reduce ? {} : { rotate: -360 }} transition={antiT}>
                <div className="rounded-full flex items-center justify-center" style={{
                  width: bub, height: bub, color: n.color,
                  background: "var(--lp-paper)", border: `1px solid ${n.color}33`,
                  boxShadow: `0 8px 22px -10px ${n.color}66, 0 0 0 5px ${n.color}0d`,
                }}>
                  <Icon k={n.k} s={mobile ? 17 : 22} />
                </div>
                <span className="mt-1 font-semibold whitespace-nowrap" style={{ fontSize: mobile ? 8.5 : 10.5, color: "var(--lp-mute)" }}>{n.name}</span>
              </motion.div>
            </div>
          ))}
        </motion.div>

        {/* QuoteGen core (fixed, glowing) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
          {!reduce && (
            <motion.div aria-hidden className="absolute rounded-full"
              style={{ width: bub * 3.2, height: bub * 3.2, background: "radial-gradient(circle, var(--lp-brand-tint), transparent 68%)" }}
              animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
          )}
          <motion.div className="relative rounded-2xl flex items-center justify-center"
            style={{ width: mobile ? 62 : 84, height: mobile ? 62 : 84, background: "var(--lp-ink)", boxShadow: "0 26px 60px -22px rgba(67,56,202,0.65)" }}
            animate={reduce ? undefined : { boxShadow: ["0 26px 60px -22px rgba(67,56,202,0.55)", "0 26px 70px -18px rgba(67,56,202,0.85)", "0 26px 60px -22px rgba(67,56,202,0.55)"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
            <span className="lp-num text-white font-bold tracking-tight" style={{ fontSize: mobile ? 19 : 26 }}>QG</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
