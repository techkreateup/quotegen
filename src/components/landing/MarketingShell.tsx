"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, ArrowUp, Lock, Menu, X } from "lucide-react";
import AccessibilityWidget from "@/components/AccessibilityWidget";

/* Shared nav + footer for all marketing pages. Uses the lp-* token system. */

const NAV = [
  { href: "/landing", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/solutions", label: "Solutions" },
  { href: "/security", label: "Security & Control" },
  { href: "/pricing", label: "Pricing" },
];

function ScrollTopFab() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="fixed z-40 flex items-center justify-center transition-transform active:scale-90"
      style={{ right: 16, bottom: 78, width: 46, height: 46, borderRadius: "50%", background: "var(--lp-ink)", color: "white", boxShadow: "0 12px 30px -10px oklch(0.25 0.02 240 / 0.5)" }}
    >
      <ArrowUp size={18} />
    </button>
  );
}

function Nav({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [active]);
  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50"
           style={{ background: "color-mix(in oklch, var(--lp-paper) 92%, transparent)", backdropFilter: "blur(14px) saturate(1.2)", borderBottom: "1px solid var(--lp-line)" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-3">
          <Link href="/landing" className="flex items-center no-underline shrink-0" style={{ color: "var(--lp-ink)" }} aria-label="QuoteGen home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/quotegen/QGF_wordmark_SVG.svg" alt="QuoteGen" className="block" style={{ height: 24, width: "auto" }} />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-[13px]">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="no-underline hover:opacity-70 transition-opacity"
                    style={{ color: active === n.href ? "var(--lp-brand-ink)" : "var(--lp-ink-soft)", fontWeight: active === n.href ? 600 : 400 }}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login"
                  className="hidden sm:inline-flex items-center h-9 px-4 rounded-full text-[13px] font-semibold no-underline transition-transform active:scale-[0.97]"
                  style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)" }}>
              Sign in
            </Link>
            <Link href="/signup"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold no-underline text-white transition-transform active:scale-[0.97]"
                  style={{ background: "var(--lp-ink)" }}>
              Try free <ArrowRight size={13} />
            </Link>
            <button type="button" onClick={() => setOpen(v => !v)}
                    aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
                    className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full"
                    style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)", color: "var(--lp-ink)" }}>
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {/* mobile drop-down menu */}
        {open && (
          <div className="md:hidden border-t" style={{ borderColor: "var(--lp-line)", background: "var(--lp-paper)" }}>
            <div className="max-w-[1240px] mx-auto px-5 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                      className="no-underline py-2.5 text-[14px]"
                      style={{ color: active === n.href ? "var(--lp-brand-ink)" : "var(--lp-ink)", fontWeight: active === n.href ? 700 : 500 }}>
                  {n.label}
                </Link>
              ))}
              <div className="flex gap-2 mt-2">
                <Link href="/login" onClick={() => setOpen(false)}
                      className="flex-1 inline-flex items-center justify-center h-10 rounded-full text-[13.5px] font-semibold no-underline"
                      style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)" }}>
                  Sign in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-[13.5px] font-semibold no-underline text-white"
                      style={{ background: "var(--lp-ink)" }}>
                  Try free <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer for fixed nav */}
      <div aria-hidden className="h-14" style={{ paddingTop: "env(safe-area-inset-top)" }} />
    </>
  );
}

export default function MarketingShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="font-display" style={{ background: "var(--lp-canvas)", color: "var(--lp-ink)", overflowX: "hidden", minHeight: "100vh" }}>
      <Nav active={active} />

      {children}

      {/* CTA band */}
      <section style={{ background: "var(--lp-ink)", color: "white" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-14 sm:py-20 text-center">
          <h2 className="font-semibold leading-[0.98] text-[2rem] sm:text-[3rem]" style={{ letterSpacing: "-0.035em" }}>
            Run your business.<br />
            <span style={{ color: "oklch(0.85 0.13 275)" }}>Start free today.</span>
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-[14.5px] font-semibold no-underline transition-transform active:scale-[0.97]"
                  style={{ background: "white", color: "var(--lp-ink)" }}>
              Try free for 3 months <ArrowUpRight size={15} />
            </Link>
            <Link href="/login" className="text-[13px] no-underline" style={{ color: "oklch(0.82 0.02 240)" }}>Already have one? Sign in.</Link>
          </div>
          <p className="mt-4 text-[12px] lp-num" style={{ color: "oklch(0.72 0.02 240)" }}>No card. Cancel anytime. Your data stays yours.</p>
        </div>
      </section>

      <footer style={{ background: "var(--lp-ink)", color: "oklch(0.72 0.02 240)" }}>
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-4 gap-8 border-t" style={{ borderColor: "oklch(0.30 0.01 240)" }}>
          <div className="sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/quotegen/QGF_wordmark_SVG.svg" alt="QuoteGen"
                 className="block" style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }} />
            <p className="text-[12px] leading-relaxed mt-3 max-w-sm">One workspace for your whole business. Made for India.</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white mb-3">Product</p>
            <ul className="space-y-2 text-[12.5px]">
              {NAV.slice(1).map((n) => (
                <li key={n.href}><Link href={n.href} className="hover:text-white transition-colors no-underline">{n.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white mb-3">Get started</p>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/signup" className="hover:text-white transition-colors no-underline">Create workspace</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors no-underline">Sign in</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors no-underline">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors no-underline">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "oklch(0.28 0.01 240)" }}>
          <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between flex-wrap gap-3 text-[11px] lp-num">
            <span>© {new Date().getFullYear()} QuoteGen. Built in Tamil Nadu. Runs pan-India.</span>
            <span className="inline-flex items-center gap-4 flex-wrap">
              <a href="https://kreateup.in" target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 no-underline hover:text-white transition-colors">
                Made by
                <span className="inline-flex items-center justify-center rounded-md shrink-0"
                      style={{ background: "#fff" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/kreateup.svg" alt="KreateUp" className="block"
                       style={{ height: 30, width: 30, objectFit: "contain" }} />
                </span>
                <span className="font-semibold text-white">KreateUp</span> · kreateup.in ↗
              </a>
              <span className="inline-flex items-center gap-2"><Lock size={11} /> Encrypted in transit and at rest</span>
            </span>
          </div>
        </div>
      </footer>
      <AccessibilityWidget />
      <ScrollTopFab />
    </div>
  );
}

/* small shared bits */
export function PageHero({ kicker, title, sub }: { kicker: string; title: React.ReactNode; sub: string }) {
  return (
    <header className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-10">
      <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--lp-mute)" }}>{kicker}</p>
      <h1 className="mt-3 font-semibold leading-[0.98]" style={{ fontSize: "clamp(2.2rem, 5vw + 0.2rem, 3.8rem)", letterSpacing: "-0.035em" }}>{title}</h1>
      <p className="mt-4 text-[15px] leading-relaxed max-w-[52ch]" style={{ color: "var(--lp-ink-soft)" }}>{sub}</p>
    </header>
  );
}
