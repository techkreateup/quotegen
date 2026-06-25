"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccessibilityWidget from "@/components/AccessibilityWidget";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  Check,
  FileText,
  IndianRupee,
  LifeBuoy,
  Lock,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { formatPlanPrice } from "@/lib/features";

/* ─────────────────────────────────────────────────────────────────────────
   Public marketing page. Logged-out visitors hitting "/" land here.
   ───────────────────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: FileText, title: "Quotations → Invoices in one click", desc: "Build branded quotes with line items, GST rates and discounts. Win the deal, convert to a compliant tax invoice instantly." },
  { icon: ReceiptText, title: "GST-compliant by default", desc: "CGST/SGST/IGST handled automatically, HSN summaries on every document, and GSTR-1 & 3B reports ready at filing time." },
  { icon: IndianRupee, title: "Payments & receipts", desc: "Record full or partial payments, auto-generate receipts, chase overdue invoices with built-in reminders." },
  { icon: Wallet, title: "Payroll & vouchers", desc: "Run monthly salaries, generate payment vouchers with sign-offs, and keep every rupee in the ledger." },
  { icon: BarChart3, title: "Live business analytics", desc: "Revenue, outstanding, expenses and cash-flow trends on one dashboard — filterable by month, quarter or year." },
  { icon: ShieldCheck, title: "Roles, approvals & audit", desc: "Per-module permissions, multi-step approval workflows, and a full audit trail of every change." },
];

const USE_CASES = [
  { icon: Briefcase, who: "Agencies & studios", pain: "Juggling retainers and project invoices across clients", win: "Recurring invoices, client-wise reports and project tracking in one place." },
  { icon: Calculator, who: "Consultants & freelancers", pain: "Chasing payments and formatting GST invoices by hand", win: "Professional documents in seconds, automatic receipts, overdue reminders." },
  { icon: Store, who: "Traders & small manufacturers", pain: "HSN codes, ITC claims and monthly GST filings", win: "Purchase bills with ITC tracking, GST challans, filing-ready reports." },
  { icon: Building2, who: "Growing SMBs", pain: "Spreadsheets that break as the team grows", win: "Team roles, approval workflows, payroll and a real audit trail." },
];


const TESTIMONIALS = [
  { quote: "We replaced three spreadsheets and a Word template with QuoteGen. Invoicing that took an afternoon now takes minutes — and GST filing stopped being scary.", name: "Priya Sharma", role: "Founder, Pixelcraft Studio" },
  { quote: "The approval workflow alone is worth it. No invoice goes out without a partner's sign-off, and the audit log shows exactly who did what.", name: "Arjun Mehta", role: "Partner, Mehta & Associates" },
  { quote: "Onboarding our team took one morning. Everyone gets exactly the access they need — sales can't touch payroll, accounts can't edit quotes.", name: "Kavitha R", role: "Operations Head, GreenLeaf Traders" },
];

const FAQS = [
  { q: "Is my company's data isolated from other companies?", a: "Completely. Every record is walled off per company at the database layer — isolation is enforced automatically on every single query, not left to application code. One company can never see another's data." },
  { q: "What does it cost?", a: "Right now, nothing — every feature is free for your first 3 months, no credit card and no locked 'pro' features. Paid plans are coming soon with featherlight pricing (cheaper than you think); we'll give you plenty of notice before anything changes." },
  { q: "Is QuoteGen GST-compliant?", a: "Yes — CGST/SGST/IGST splits, HSN/SAC codes, amount-in-words in Indian format, HSN summaries, purchase bills with ITC tracking, and GSTR-1/3B-ready reports." },
  { q: "Can I control what my team can see and do?", a: "Yes. Assign per-module permissions (view/create/edit/delete) per role, add approval workflows for sensitive documents, and review the full audit trail anytime." },
  { q: "What if I need help?", a: "Report an issue from inside the app and our support team picks it up — you can track status and replies right from your workspace." },
];

interface LandingPlan { name: string; description: string; features: string[]; maxUsers: number | null; comingSoon: boolean; price: string; priceInPaise: number; originalPriceInPaise?: number | null; billingPeriod: string }

export default function LandingPage() {
  // Live plan catalogue (reflects super-admin edits) + launch messaging.
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [launch, setLaunch] = useState<{ tagline: string; teaser: string; freeNote: string } | null>(null);
  const [featLabels, setFeatLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => {
        setPlans(d.plans ?? []);
        setLaunch(d.launch ?? null);
        setFeatLabels(Object.fromEntries((d.features ?? []).map((f: { key: string; label: string }) => [f.key, f.label])));
      })
      .catch(() => {});
  }, []);

  // Scroll-reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("mk-visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".mk-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-white text-slate-900" style={{ fontFeatureSettings: '"ss01"' }}>
      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2.5 no-underline shrink-0">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}>
              <Zap size={17} color="white" strokeWidth={2.5} />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight">QuoteGen</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13.5px] font-semibold text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#use-cases" className="hover:text-slate-900 transition-colors">Who it&apos;s for</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/login" className="text-[13.5px] font-bold text-slate-700 hover:text-slate-900 no-underline px-2 py-2">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 h-10 px-4 sm:px-5 rounded-xl text-white text-[13.5px] font-bold no-underline transition-all hover:shadow-[0_6px_20px_rgba(99,102,241,0.45)] hover:-translate-y-px"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 2px 10px rgba(99,102,241,0.35)" }}
            >
              Get started free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <header id="top" className="relative overflow-hidden">
        {/* background décor */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.14), transparent)" }} />
          <div className="absolute top-32 -left-32 w-[420px] h-[420px] rounded-full mk-float-slow" style={{ background: "radial-gradient(closest-side, rgba(168,85,247,0.10), transparent)" }} />
          <div className="absolute top-48 -right-24 w-[380px] h-[380px] rounded-full mk-float" style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.10), transparent)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(99,102,241,0.08) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-10 text-center">
          <span className="mk-fade-up inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-4 py-1.5 text-[12.5px] font-bold text-indigo-700">
            <Sparkles size={13} /> Built for Indian businesses · GST-ready
          </span>
          <h1 className="mk-fade-up-1 mt-6 text-[34px] sm:text-[52px] leading-[1.08] font-extrabold tracking-tight max-w-4xl mx-auto">
            The business suite that turns <span className="mk-gradient-text">Quotes into cash</span>
          </h1>
          <p className="mk-fade-up-2 mt-5 text-[15.5px] sm:text-[17px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Quotations, GST invoices, payments, payroll and reports — everything your business runs on,
            in one secure workspace your whole team can use. <strong className="text-slate-700 font-bold">Every feature, free for 3 months.</strong>
          </p>
          <div className="mk-fade-up-3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-white text-[15px] font-bold no-underline transition-all hover:shadow-[0_8px_28px_rgba(99,102,241,0.5)] hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}
            >
              Create your free workspace <ArrowRight size={16} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-700 text-[15px] font-bold no-underline transition-all hover:border-slate-300 hover:shadow-sm"
            >
              See how it works
            </a>
          </div>
          <p className="mk-fade-up-4 mt-4 text-[12.5px] text-slate-400 flex items-center justify-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-emerald-500" /> Free for 3 months</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-emerald-500" /> No credit card, no trial clock</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={13} className="text-indigo-400" /> Company-level data isolation</span>
          </p>

          {/* ── Product mockup ── */}
          <div className="mk-fade-up-4 relative mt-14 sm:mt-16 max-w-5xl mx-auto">
            <div className="absolute inset-x-8 -bottom-6 h-24 rounded-[40px] blur-3xl opacity-40" style={{ background: "linear-gradient(90deg,#6366F1,#A855F7)" }} aria-hidden />
            <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] overflow-hidden text-left">
              {/* window chrome */}
              <div className="flex items-center gap-2 px-4 h-10 border-b border-slate-100 bg-slate-50/70">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" /><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md px-3 py-0.5">app.quotegen.in/dashboard</span>
              </div>
              <div className="grid grid-cols-[160px_1fr] max-sm:grid-cols-1">
                {/* mini sidebar */}
                <div className="max-sm:hidden border-r border-slate-100 p-3 space-y-1">
                  {["Dashboard", "Clients", "Quotations", "Invoices", "Receipts", "Payroll", "Reports", "GST Returns"].map((l, i) => (
                    <div key={l} className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 ${i === 0 ? "bg-indigo-50 text-indigo-600" : "text-slate-400"}`}>{l}</div>
                  ))}
                </div>
                {/* mini dashboard */}
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[["Revenue", "₹24.8L", "text-slate-900"], ["Collected", "₹21.6L", "text-emerald-600"], ["Outstanding", "₹3.2L", "text-amber-600"], ["Net profit", "₹8.4L", "text-indigo-600"]].map(([l, v, c]) => (
                      <div key={l as string} className="rounded-xl border border-slate-100 bg-white shadow-sm px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                        <p className={`text-[17px] font-extrabold mt-0.5 ${c}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-[1.6fr_1fr] gap-3">
                    {/* line chart */}
                    <div className="rounded-xl border border-slate-100 shadow-sm p-4">
                      <p className="text-[11px] font-bold text-slate-500 mb-2">Cash flow · last 6 months</p>
                      <svg viewBox="0 0 300 90" className="w-full">
                        {[18, 40, 62, 84].map((y) => <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#F1F5F9" strokeWidth="1" />)}
                        <polyline points="0,70 50,60 100,64 150,42 200,46 250,24 300,16" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="600" style={{ animation: "mk-line-draw 2.2s ease-out 400ms both" }} />
                        <polyline points="0,80 50,76 100,78 150,70 200,72 250,64 300,60" fill="none" stroke="#FB7185" strokeWidth="2" strokeDasharray="5 4" opacity="0.8" />
                        <circle cx="300" cy="16" r="3.5" fill="#6366F1" />
                      </svg>
                    </div>
                    {/* invoice list */}
                    <div className="rounded-xl border border-slate-100 shadow-sm p-4 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-500">Recent invoices</p>
                      {[["INV00042", "Paid", "text-emerald-600 bg-emerald-50"], ["INV00041", "Sent", "text-indigo-600 bg-indigo-50"], ["INV00040", "Overdue", "text-red-500 bg-red-50"]].map(([no, st, c]) => (
                        <div key={no as string} className="flex items-center justify-between">
                          <span className="text-[11.5px] font-bold text-slate-700">{no}</span>
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${c}`}>{st}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* floating chips */}
            <div className="absolute -left-6 top-1/3 max-md:hidden rounded-xl bg-white shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3 mk-float">
              <span className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><FileText size={16} className="text-indigo-500" /></span>
              <div><p className="text-[12px] font-bold leading-none">Quote Q00018 won 🎉</p><p className="text-[10.5px] text-slate-400 mt-1 leading-none">Converted to invoice</p></div>
            </div>
            <div className="absolute -right-5 bottom-10 max-md:hidden rounded-xl bg-white shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3 mk-float-slow">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><IndianRupee size={16} className="text-emerald-500" /></span>
              <div><p className="text-[12px] font-bold leading-none">₹58,000 received</p><p className="text-[10.5px] text-slate-400 mt-1 leading-none">Receipt auto-generated</p></div>
            </div>
          </div>
        </div>

        {/* trust strip */}
        <div className="relative border-y border-slate-100 bg-slate-50/60 mt-6">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-center gap-x-8 gap-y-2 flex-wrap text-[12px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-indigo-400" /> GST-compliant documents</span>
            <span className="flex items-center gap-1.5"><Lock size={14} className="text-indigo-400" /> Tenant-isolated by design</span>
            <span className="flex items-center gap-1.5"><Users size={14} className="text-indigo-400" /> Role-based access</span>
            <span className="flex items-center gap-1.5"><LifeBuoy size={14} className="text-indigo-400" /> In-app support desk</span>
          </div>
        </div>
      </header>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section id="features" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mk-reveal">
          <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">Everything included</p>
          <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight mt-3">One workspace. Every workflow.</h2>
          <p className="text-[15px] text-slate-500 mt-3">Stop stitching together spreadsheets, Word templates and WhatsApp follow-ups.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="mk-reveal group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)] hover:-translate-y-1 hover:border-indigo-100"
              style={{ transitionDelay: `${(i % 3) * 80}ms` }}
            >
              <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)" }}>
                <f.icon size={19} className="text-indigo-600" />
              </span>
              <h3 className="text-[15.5px] font-extrabold tracking-tight">{f.title}</h3>
              <p className="text-[13.5px] text-slate-500 leading-relaxed mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mk-reveal">
            <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">From signup to first invoice</p>
            <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight mt-3">Live in three steps</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mt-12">
            {[
              { n: "01", t: "Create your workspace", d: "Sign up with your company name — your isolated workspace, roles and settings are ready instantly.", icon: Building2 },
              { n: "02", t: "Guided onboarding", d: "Add your business profile, invite teammates with the right roles, and follow the checklist.", icon: Users },
              { n: "03", t: "Send your first quote", d: "Pick a client, add line items, hit send. When it's won, one click makes it a GST invoice.", icon: FileText },
            ].map((s, i) => (
              <div key={s.n} className="mk-reveal relative rounded-2xl bg-white border border-slate-100 shadow-sm p-7" style={{ transitionDelay: `${i * 100}ms` }}>
                <span className="absolute -top-4 left-7 text-white text-[12px] font-extrabold rounded-full px-3 py-1.5" style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}>{s.n}</span>
                <s.icon size={22} className="text-indigo-500 mt-2" />
                <h3 className="text-[16px] font-extrabold mt-3">{s.t}</h3>
                <p className="text-[13.5px] text-slate-500 leading-relaxed mt-2">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ───────────────────────────────────────────────── */}
      <section id="use-cases" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mk-reveal">
          <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">Who it&apos;s for</p>
          <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight mt-3">Built for how Indian businesses actually bill</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mt-12">
          {USE_CASES.map((u, i) => (
            <div key={u.who} className="mk-reveal rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex gap-5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)] transition-all" style={{ transitionDelay: `${(i % 2) * 80}ms` }}>
              <span className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#EEF2FF,#FAE8FF)" }}>
                <u.icon size={20} className="text-indigo-600" />
              </span>
              <div>
                <h3 className="text-[15.5px] font-extrabold">{u.who}</h3>
                <p className="text-[13px] text-slate-400 mt-1.5 line-through decoration-red-300">{u.pain}</p>
                <p className="text-[13.5px] text-slate-600 mt-1 font-medium flex items-start gap-1.5">
                  <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" /> {u.win}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────── */}
      <section id="pricing" className="border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
          <div className="text-center max-w-2xl mx-auto mk-reveal">
            <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-purple-600">{launch?.tagline ?? "Featherlight pricing"}</p>
            <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight mt-3">
              Free for 3 months. <span className="mk-gradient-text">Every feature.</span>
            </h2>
            <p className="text-[15px] text-slate-500 mt-3">
              {launch?.freeNote ?? "Every feature, free for 3 months — no card, no trial clock."}{" "}
              {launch?.teaser ?? "Paid plans coming soon — cheaper than you think."}
            </p>
          </div>

          <div className="mk-reveal grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14 max-w-6xl mx-auto">
            {plans.map((p) => {
              const live = !p.comingSoon;
              return (
                <div
                  key={p.name}
                  className={`relative rounded-2xl border bg-white p-6 flex flex-col ${live ? "border-indigo-300 shadow-[0_16px_50px_rgba(99,102,241,0.18)]" : "border-slate-200"}`}
                >
                  {live ? (
                    <span className="absolute -top-3 left-6 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white bg-indigo-600 rounded-full px-3 py-1">
                      <Sparkles size={11} /> Available now
                    </span>
                  ) : (
                    <span className="absolute -top-3 right-6 text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100 rounded-full px-3 py-1">Coming soon</span>
                  )}
                  <h3 className="text-[18px] font-extrabold tracking-tight">{p.name}</h3>
                  <p className="text-[12.5px] text-slate-400 mt-1 min-h-[34px]">{p.description}</p>
                  <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    {p.originalPriceInPaise && p.originalPriceInPaise > p.priceInPaise && (
                      <span className="text-[14px] text-slate-400 line-through">{formatPlanPrice(p.originalPriceInPaise, p.billingPeriod)}</span>
                    )}
                    <span className="text-[22px] font-extrabold text-indigo-600">{formatPlanPrice(p.priceInPaise, p.billingPeriod)}</span>
                    {p.originalPriceInPaise && p.originalPriceInPaise > p.priceInPaise && (() => {
                      const pct = Math.round(((p.originalPriceInPaise - p.priceInPaise) / p.originalPriceInPaise) * 100);
                      return pct > 0 ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Save {pct}%</span> : null;
                    })()}
                  </div>
                  <p className="text-[12px] text-slate-400 mb-4">{p.maxUsers == null ? "Unlimited seats" : `${p.maxUsers} seats`}</p>
                  <ul className="space-y-2 flex-1">
                    {p.features.slice(0, 7).map((k) => (
                      <li key={k} className="flex items-start gap-2 text-[13px] text-slate-700">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={10} className="text-emerald-600" strokeWidth={3} />
                        </span>
                        {featLabels[k] ?? k}
                      </li>
                    ))}
                    {p.features.length > 7 && <li className="text-[12px] text-slate-400 pl-6">+{p.features.length - 7} more</li>}
                  </ul>
                  <Link
                    href="/signup"
                    aria-disabled={!live}
                    className={`mt-5 inline-flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-bold no-underline transition-all ${
                      live ? "text-white hover:-translate-y-0.5" : "bg-slate-100 text-slate-400 pointer-events-none"
                    }`}
                    style={live ? { background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" } : undefined}
                  >
                    {live ? <>Start free <ArrowRight size={15} /></> : "Notify me"}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="text-center text-[12px] text-slate-400 mt-8">No credit card. No catch. Sign up and start billing in minutes.</p>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mk-reveal">
          <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">Loved by operators</p>
          <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight mt-3">Teams ship invoices, not spreadsheets</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mt-12">
          {TESTIMONIALS.map((t, i) => (
            <figure key={t.name} className="mk-reveal rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="text-indigo-400 text-[28px] leading-none font-serif">&ldquo;</div>
              <blockquote className="text-[13.5px] text-slate-600 leading-relaxed mt-1">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-extrabold" style={{ background: `linear-gradient(135deg,${["#6366F1,#A855F7", "#0EA5E9,#6366F1", "#10B981,#0EA5E9"][i]})` }}>
                  {t.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-[13px] font-extrabold">{t.name}</span>
                  <span className="block text-[11.5px] text-slate-400">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-slate-100 bg-slate-50/60">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20">
          <div className="text-center mk-reveal">
            <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">FAQ</p>
            <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight mt-3">Questions, answered</h2>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="mk-reveal group rounded-2xl border border-slate-200 bg-white px-6 py-4 open:shadow-md transition-shadow">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[14.5px] font-bold text-slate-800">
                  {f.q}
                  <span className="text-indigo-500 text-lg leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                </summary>
                <p className="text-[13.5px] text-slate-500 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(160deg,#1E1B4B 0%,#312E81 50%,#4338CA 100%)" }}>
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full mk-float-slow" style={{ background: "radial-gradient(circle, rgba(129,140,248,0.3), transparent 70%)" }} aria-hidden />
        <div className="absolute -bottom-24 -left-16 w-[360px] h-[360px] rounded-full mk-float" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.22), transparent 70%)" }} aria-hidden />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
          <h2 className="mk-reveal text-white text-[28px] sm:text-[38px] font-extrabold tracking-tight leading-tight">
            Your next invoice could take 30 seconds.
          </h2>
          <p className="mk-reveal text-indigo-200 text-[15px] mt-4 max-w-xl mx-auto">
            Join businesses that replaced spreadsheets with a workspace their whole team loves to use.
          </p>
          <div className="mk-reveal mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-indigo-700 text-[15px] font-extrabold no-underline transition-all hover:shadow-[0_10px_32px_rgba(255,255,255,0.3)] hover:-translate-y-0.5"
            >
              Get started — it&apos;s free <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="text-indigo-200 text-[14px] font-bold no-underline hover:text-white transition-colors">
              or sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="bg-[#0F172A] text-slate-400">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 grid sm:grid-cols-4 gap-10">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)" }}>
                <Zap size={15} color="white" strokeWidth={2.5} />
              </span>
              <span className="text-[15px] font-extrabold text-white">QuoteGen</span>
            </div>
            <p className="text-[12.5px] leading-relaxed mt-3 max-w-sm">
              GST-compliant quotations, invoicing, payments and payroll for Indian businesses — with
              enterprise-grade data isolation per company.
            </p>
          </div>
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Product</p>
            <ul className="space-y-2 text-[13px]">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#use-cases" className="hover:text-white transition-colors">Use cases</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Get started</p>
            <ul className="space-y-2 text-[13px]">
              <li><Link href="/signup" className="hover:text-white transition-colors no-underline text-slate-400">Create workspace</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors no-underline text-slate-400">Sign in</Link></li>
              <li><Link href="/forgot-password" className="hover:text-white transition-colors no-underline text-slate-400">Reset password</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between flex-wrap gap-3 text-[11.5px]">
            <span>© {new Date().getFullYear()} QuoteGen. All rights reserved.</span>
            <span className="flex items-center gap-1.5"><RefreshCw size={11} /> 99.9% uptime · <Lock size={11} /> Encrypted in transit &amp; at rest</span>
          </div>
        </div>
      </footer>
      <AccessibilityWidget />
    </div>
  );
}
