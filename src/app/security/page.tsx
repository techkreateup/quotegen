"use client";

import { motion } from "motion/react";
import {
  UserCheck, GitBranch, History, PenTool, KeyRound, Trash2,
  Lock, Database, ShieldCheck, FileDown,
} from "lucide-react";
import MarketingShell, { PageHero } from "@/components/landing/MarketingShell";

/* Control & accountability first, infrastructure second. All features are live. */

const CONTROL = [
  { icon: UserCheck, t: "Know who can do what", d: "Roles with per-module permissions. Your billing clerk sees invoices, not salaries. Your accountant sees reports, not employee records.", tag: "Roles & permissions" },
  { icon: GitBranch, t: "Know who approved it", d: "Multi-step approval workflows on quotations, invoices, purchase orders and payroll. Nothing big goes out on one person's say-so.", tag: "Approval workflows" },
  { icon: History, t: "Know who changed it", d: "Every create, edit and delete lands in the audit log — with before and after values, who did it, and when.", tag: "Audit log" },
  { icon: PenTool, t: "Know who signed it", d: "Role-tagged e-signatures are stamped onto documents at the moment of approval. Signing authority and approval authority stay separate.", tag: "E-signatures" },
  { icon: Trash2, t: "Undo honest mistakes", d: "Deleted records go to a recycle bin, not into the void. Restore in one click — the audit trail keeps the full story.", tag: "Recycle bin" },
  { icon: KeyRound, t: "Lock the front door", d: "Two-factor authentication, email verification, and session controls on every account.", tag: "2FA & auth" },
];

const INFRA = [
  { icon: Database, t: "Your data is walled off", d: "Every record is scoped to your company at the database layer itself — enforced in code on every single query, not by convention." },
  { icon: Lock, t: "Encrypted end to end", d: "TLS in transit, encryption at rest, strict security headers (CSP, HSTS) on every response." },
  { icon: ShieldCheck, t: "Hardened by default", d: "Rate limiting, CSRF protection, input validation on every write. Security gates fail closed." },
  { icon: FileDown, t: "You can always leave", d: "Full data export on demand, and account deletion under India's DPDP rules. Your data is yours, not ours." },
];

export default function SecurityPage() {
  return (
    <MarketingShell active="/security">
      <PageHero kicker="Security & Control"
        title={<>Who created it. Who changed it.<br /><span style={{ color: "var(--lp-brand-ink)" }}>Who approved it.</span></>}
        sub="A business runs on trust — but trust needs a paper trail. QuoteGen answers the questions owners actually ask, on every record, automatically." />

      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-16 space-y-12">
        {/* control */}
        <section>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTROL.map((c, i) => (
              <motion.div key={c.t}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                whileHover={{ y: -3 }}
                className="rounded-2xl p-6" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
                <c.icon size={20} strokeWidth={1.7} style={{ color: "var(--lp-brand-ink)" }} />
                <h2 className="mt-3 text-[16.5px] font-semibold" style={{ letterSpacing: "-0.015em" }}>{c.t}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>{c.d}</p>
                <span className="mt-3 inline-block text-[10.5px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full lp-num"
                      style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>{c.tag}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* audit log proof strip */}
        <section className="rounded-2xl p-6 sm:p-8" style={{ background: "var(--lp-ink)", color: "white" }}>
          <p className="text-[10.5px] uppercase tracking-[0.22em]" style={{ color: "oklch(0.85 0.13 275)" }}>What the audit log actually looks like</p>
          <div className="mt-5 space-y-0 lp-num text-[12px] sm:text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {[
              { t: "09:41", who: "Priya (Owner)", act: "APPROVED", obj: "Invoice INV-2026-0417 · ₹1,18,000" },
              { t: "09:38", who: "Arun (Sales)", act: "UPDATED", obj: "Quotation QT-0341 · discount 5% → 8%" },
              { t: "09:12", who: "Meena (Accounts)", act: "CREATED", obj: "Payment receipt against INV-2026-0412" },
              { t: "08:55", who: "System", act: "REMINDER SENT", obj: "INV-2026-0398 · overdue 30 days" },
            ].map((r, i) => (
              <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[52px_150px_130px_1fr] gap-x-4 gap-y-0.5 py-3 border-t"
                   style={{ borderColor: "oklch(0.32 0.02 240)" }}>
                <span style={{ color: "oklch(0.65 0.02 240)" }}>{r.t}</span>
                <span className="font-semibold text-white">{r.who}</span>
                <span style={{ color: "oklch(0.85 0.13 275)" }}>{r.act}</span>
                <span className="col-span-2 sm:col-span-1" style={{ color: "oklch(0.78 0.02 240)" }}>{r.obj}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px]" style={{ color: "oklch(0.65 0.02 240)" }}>
            Illustrative entries — the format is exactly what your audit log records for every action.
          </p>
        </section>

        {/* infrastructure */}
        <section>
          <h2 className="text-[20px] sm:text-[24px] font-semibold" style={{ letterSpacing: "-0.02em" }}>And under the floorboards</h2>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INFRA.map((c) => (
              <div key={c.t} className="rounded-2xl p-5" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
                <c.icon size={18} strokeWidth={1.7} style={{ color: "var(--lp-ink)" }} />
                <h3 className="mt-3 text-[14.5px] font-semibold" style={{ letterSpacing: "-0.01em" }}>{c.t}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>{c.d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
