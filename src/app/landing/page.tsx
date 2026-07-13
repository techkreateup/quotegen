"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, ShieldCheck } from "lucide-react";
import MarketingShell from "@/components/landing/MarketingShell";
import DemoApp from "@/components/landing/DemoApp";
import SevenToOne from "@/components/landing/SevenToOne";
import HeroPaymentDemo from "@/components/landing/HeroPaymentDemo";
import RealDocGallery from "@/components/landing/RealDocs";
import TaskGrid from "@/components/landing/TaskGrid";
import PricingTeaser from "@/components/landing/PricingTeaser";
import DayInMotion from "@/components/landing/DayInMotion";
import CashConsole from "@/components/landing/CashConsole";
import OwnerLedger from "@/components/landing/OwnerLedger";

/* Homepage — a chaptered product journey, not a feature list.
   Every visual on this page renders a real QuoteGen screen or document. */

const EASE = [0.23, 1, 0.32, 1] as const;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/* Chapter header: numbered spine + accent color per theme */
function Chapter({ n, color, kicker, title, sub }: { n: string; color: string; kicker: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal>
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="flex flex-col items-center pt-1.5">
          <span className="lp-num text-[11px] font-bold px-2 py-1 rounded-md" style={{ background: `${color}18`, color }}>{n}</span>
          <span className="w-px flex-1 mt-2 hidden sm:block" style={{ background: `linear-gradient(${color}66, transparent)`, minHeight: 40 }} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color }}>{kicker}</p>
          <h2 className="mt-2 font-semibold leading-[1.02]" style={{ fontSize: "clamp(1.9rem, 3.6vw + 0.4rem, 3rem)", letterSpacing: "-0.03em" }}>{title}</h2>
          {sub && <p className="mt-3 text-[14.5px] leading-relaxed max-w-[54ch]" style={{ color: "var(--lp-ink-soft)" }}>{sub}</p>}
        </div>
      </div>
    </Reveal>
  );
}

/* Live clock — the emotional hook. Shows the visitor's actual time.
   Isolated as a leaf component so its 1s tick doesn't re-render the whole
   hero (which contains the ~1000-line DemoApp). */
function ClockBadge() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const h = now?.getHours() ?? 21;
  const late = h >= 19 || h < 6;
  const t = now ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "9:47 pm";
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px]"
         style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)", color: "var(--lp-ink-soft)" }}>
      <span className="lp-num font-semibold" style={{ color: late ? "var(--lp-pain)" : "var(--lp-brand-ink)" }}>{t}</span>
      {late ? "— still doing paperwork?" : "— imagine being done by 6."}
    </div>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[560px] rounded-full"
             style={{ background: "radial-gradient(closest-side, oklch(0.85 0.13 275 / 0.32), transparent 70%)" }} />
      </div>
      <div className="relative max-w-[1240px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-16">
        <motion.div className="text-center max-w-[760px] mx-auto"
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <ClockBadge />

          <h1 className="mt-6 font-semibold leading-[0.98]"
              style={{ fontSize: "clamp(2.4rem, 5vw + 0.4rem, 4.2rem)", letterSpacing: "-0.035em" }}>
            Your business, <span style={{ color: "var(--lp-brand-ink)" }}>off your mind</span> by evening.
          </h1>

          <p className="mt-5 text-[16px] leading-[1.55] max-w-[46ch] mx-auto" style={{ color: "var(--lp-ink-soft)" }}>
            Quotes, invoices, cash, GST, salaries, approvals — one workspace runs the paperwork,
            so you run the business. Made for India.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-[14.5px] font-semibold no-underline text-white transition-transform active:scale-[0.97]"
                  style={{ background: "var(--lp-ink)" }}>
              Try free for 3 months <ArrowRight size={15} />
            </Link>
            <a href="#day" className="inline-flex items-center gap-2 h-12 px-5 rounded-full text-[13.5px] font-semibold no-underline"
               style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)", color: "var(--lp-ink)" }}>
              See one full day <ChevronDown size={14} />
            </a>
          </div>
          <p className="mt-4 text-[12px] lp-num" style={{ color: "var(--lp-mute)" }}>Free until Oct 2026 · No card · Every module</p>
          <a href="https://kreateup.in" target="_blank" rel="noopener noreferrer"
             className="group mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] no-underline transition-all hover:-translate-y-px active:scale-[0.97]"
             style={{
               background: "linear-gradient(135deg, var(--lp-paper), var(--lp-brand-tint))",
               border: "1px solid var(--lp-brand-ink)",
               color: "var(--lp-ink-soft)",
               boxShadow: "0 6px 16px -8px oklch(0.42 0.16 275 / 0.35)",
             }}>
            <span>A product by <span className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>KreateUp</span></span>
            <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          style={{ color: "var(--lp-brand-ink)" }} />
          </a>
        </motion.div>

        {/* interactive product tour — try the modules right here */}
        <motion.div className="mt-10 sm:mt-12"
                    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }}>
          <DemoApp />
          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--lp-mute)" }}>
            This is the actual product with sample data — open any module, follow the tour, nothing saves.{" "}
            <Link href="/demo" className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Open full-screen ↗</Link>
          </p>
        </motion.div>
      </div>
    </header>
  );
}

/* Chapter 02 — one day, color-coded timeline of real workflow events */
const DAY = [
  { t: "09:12", c: "#4338CA", who: "You",   what: "Quote QT-0341 drafted", d: "Client picked from list, items from catalog, GST auto-split. 4 minutes." },
  { t: "09:15", c: "#B91C1C", who: "Partner", what: "Quote approved & e-signed", d: "Approval workflow pinged them. Signature stamped on the PDF." },
  { t: "11:40", c: "#4338CA", who: "You",   what: "Client accepted → Sales Order", d: "One click. Their PO number attached to the whole chain." },
  { t: "14:05", c: "#4338CA", who: "Staff", what: "Challan raised, invoice sent", d: "Dispatch documented. GST invoice emailed + WhatsApp'd." },
  { t: "16:30", c: "#047857", who: "System", what: "Payment recorded, receipt issued", d: "Cash Command Center updates. Ageing bucket clears." },
  { t: "18:00", c: "#B45309", who: "You",   what: "You go home", d: "GSTR-1 entry already compiled. Audit log remembers everything." },
];

function DayTimeline() {
  return (
    <div className="mt-10 relative">
      <span aria-hidden className="absolute left-[27px] sm:left-[31px] top-2 bottom-2 w-px" style={{ background: "var(--lp-line)" }} />
      <div className="space-y-3">
        {DAY.map((e, i) => (
          <Reveal key={e.t} delay={i * 0.06}>
            <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[64px_1fr] gap-4 items-start">
              <div className="relative pt-3.5 text-right">
                <span className="lp-num text-[12px] font-semibold" style={{ color: e.c }}>{e.t}</span>
                <span aria-hidden className="absolute right-[-21px] sm:right-[-25px] top-[19px] w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: "var(--lp-canvas)", borderColor: e.c }} />
              </div>
              <div className="rounded-xl px-5 py-3.5" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[10.5px] uppercase tracking-widest font-bold lp-num" style={{ color: e.c }}>{e.who}</span>
                  <span className="text-[14.5px] font-semibold">{e.what}</span>
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--lp-ink-soft)" }}>{e.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.2}>
        <p className="mt-6 ml-[76px] sm:ml-[84px] text-[12.5px]" style={{ color: "var(--lp-mute)" }}>
          Six events. Zero retyping. Every step is a real screen — quote, approval, order, challan, invoice, receipt.
        </p>
      </Reveal>
    </div>
  );
}


export default function LandingPage() {
  return (
    <MarketingShell active="/landing">
      <Hero />

      {/* CH 01 — the old way vs the new way */}
      <section className="lp-hair" style={{ background: "var(--lp-paper)" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="01" color="#DC2626" kicker="The problem you know"
            title={<>Your business lives in<br />seven different places.</>}
            sub="Excel for billing. WhatsApp for follow-ups. A notebook for who owes what. Watch them collapse into one." />
          <SevenToOne />
        </div>
      </section>

      {/* CH 02 — one day */}
      <section id="day" className="lp-hair">
        <div className="max-w-[1000px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="02" color="#4338CA" kicker="One day with QuoteGen"
            title={<>Watch a Tuesday<br />run itself.</>}
            sub="Three flows running side-by-side — sales, procurement, compliance — on one day, one screen. Hover to pause. Click any event to see what really happened." />
          <DayInMotion />
        </div>
      </section>

      {/* CH 03 — money */}
      <section className="lp-hair" style={{ background: "var(--lp-paper)" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="03" color="#047857" kicker="Money, watched"
            title={<>Know where every<br />rupee stands.</>}
            sub="Not a chart — the real Cash Command Center. Receivables aged 30/60/90, payables due this week, net position live, and every overdue chase already queued to fire itself." />
          <Reveal delay={0.1} className="mt-10"><CashConsole /></Reveal>
        </div>
      </section>

      {/* CH 04 — proof: real documents */}
      <section className="lp-hair">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="04" color="#B45309" kicker="Proof, not promises"
            title={<>The documents<br />it actually produces.</>}
            sub="Pick a document type. What renders below is the genuine output — generated live by the same engine your invoices will use, GST-compliant down to the HSN summary and amount in words." />
          <Reveal delay={0.1} className="mt-10"><RealDocGallery /></Reveal>
        </div>
      </section>

      {/* CH 05 — control (dark) */}
      <section className="lp-hair" style={{ background: "var(--lp-ink)", color: "white" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Reveal>
            <div className="flex items-start gap-4 sm:gap-6">
              <span className="lp-num text-[11px] font-bold px-2 py-1 rounded-md mt-1.5" style={{ background: "oklch(0.85 0.13 275 / 0.15)", color: "oklch(0.85 0.13 275)" }}>05</span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: "oklch(0.85 0.13 275)" }}>You stay in charge</p>
                <h2 className="mt-2 font-semibold leading-[1.02]" style={{ fontSize: "clamp(1.9rem, 3.6vw + 0.4rem, 3rem)", letterSpacing: "-0.03em" }}>
                  Your team works.<br />You see everything.
                </h2>
                <p className="mt-3 text-[14.5px] leading-relaxed max-w-[54ch]" style={{ color: "oklch(0.75 0.02 240)" }}>
                  Growth means handing work to others. QuoteGen makes that safe — not by trust, by record.
                </p>
              </div>
            </div>
          </Reveal>
          <OwnerLedger />
          <Reveal delay={0.2}>
            <Link href="/security" className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold no-underline"
                  style={{ color: "oklch(0.85 0.13 275)" }}>
              See the full control system <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CH 06 — the workspace itself */}
      <section className="lp-hair" style={{ background: "var(--lp-paper)" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="06" color="#4338CA" kicker="The workspace"
            title={<>The jobs<br />you&apos;ll actually do.</>}
            sub="Everything else on this page runs itself. This is the short list of things that still need you — and how few taps each one takes." />
          <Reveal delay={0.1} className="mt-10"><TaskGrid /></Reveal>
        </div>
      </section>

      {/* CH 07 — pricing teaser */}
      <section className="lp-hair" style={{ background: "var(--lp-canvas)" }}>
        <div className="max-w-[1000px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <Chapter n="07" color="#4338CA" kicker="Pricing"
            title={<>Simple plans.<br />Nothing locked.</>}
            sub="Every module in every plan — Sales, GST, payroll, approvals, audit. Plans differ only by seats and scale." />
          <Reveal delay={0.1} className="mt-10"><PricingTeaser /></Reveal>
        </div>
      </section>

      {/* CLOSE — 3 minutes + honest answers */}
      <section className="lp-hair">
        <div className="max-w-[1000px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Getting in</p>
              <h2 className="mt-2 text-[1.9rem] font-semibold leading-[1.05]" style={{ letterSpacing: "-0.03em" }}>Live in three minutes.</h2>
              <ol className="mt-6 space-y-4">
                {[
                  ["Create your workspace", "Company name, your name, email. That's it."],
                  ["Add a client", "Name, GSTIN, address — or import a list."],
                  ["Send your first document", "Quote or invoice. Branded, compliant, gone."],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[32px_1fr] gap-3">
                    <span className="lp-num text-[13px] font-bold w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>{i + 1}</span>
                    <div>
                      <p className="text-[15px] font-semibold">{t}</p>
                      <p className="text-[13px]" style={{ color: "var(--lp-ink-soft)" }}>{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href="/signup"
                    className="mt-7 inline-flex items-center gap-2 h-11 px-5 rounded-full text-[14px] font-semibold no-underline text-white"
                    style={{ background: "var(--lp-ink)" }}>
                Start now — it&apos;s free <ArrowRight size={14} />
              </Link>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: "var(--lp-mute)" }}>Fair questions</p>
              <div className="mt-2 divide-y" style={{ borderColor: "var(--lp-line)" }}>
                {[
                  ["Do I need to be an accountant?", "No. Plain labels, big buttons. If you can send a WhatsApp, you can send a GST invoice."],
                  ["Is my data safe?", "Walled off per company at the database, encrypted in transit and at rest, every change audited."],
                  ["Does it work on my phone?", "Every screen, full function. No desktop lock-in."],
                  ["What does it cost?", "Free for 3 months, every module, no card. Simple plans after — see Pricing."],
                ].map(([q, a]) => (
                  <details key={q} className="group py-4">
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-[15px] font-medium">
                      {q}
                      <ChevronDown size={15} className="mt-1 shrink-0 group-open:rotate-180 transition-transform" style={{ color: "var(--lp-mute)" }} />
                    </summary>
                    <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>{a}</p>
                  </details>
                ))}
              </div>
              <p className="mt-5 inline-flex items-center gap-2 text-[12.5px]" style={{ color: "var(--lp-mute)" }}>
                <ShieldCheck size={13} /> Every visual on this page is a real QuoteGen screen or document.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
