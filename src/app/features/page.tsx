"use client";

import { motion } from "motion/react";
import {
  FileText, IndianRupee, Landmark, Users, PackageSearch, ShieldCheck,
  Repeat, FolderKanban, BarChart3, BookOpen, Bell, Trash2,
} from "lucide-react";
import { Settings2, Sparkles } from "lucide-react";
import MarketingShell, { PageHero } from "@/components/landing/MarketingShell";
import RealDocGallery from "@/components/landing/RealDocs";

/* Full capability map. Every item maps to a real route in the app. */

const GROUPS = [
  {
    icon: FileText, name: "Sell & get paid", tint: "var(--lp-brand-tint)", ink: "var(--lp-brand-ink)",
    lead: "The complete order-to-cash chain. One document flows into the next — nothing retyped.",
    items: [
      { t: "Quotations", d: "Branded, GST-ready quotes with line items, HSN codes and win tracking." },
      { t: "Sales Orders", d: "Convert an accepted quote into a confirmed order in one click." },
      { t: "Delivery Challans", d: "Dispatch documents raised straight from the order." },
      { t: "Invoices", d: "GST-compliant invoices — CGST/SGST/IGST auto-split, HSN summary, amount in words." },
      { t: "Payment Receipts", d: "Record a payment, and the receipt issues itself." },
      { t: "Recurring Invoices", d: "Retainers and subscriptions bill themselves every month." },
      { t: "Credit Notes", d: "Returns and corrections handled the compliant way." },
      { t: "Client PO capture", d: "Attach the client's purchase order to the whole chain." },
    ],
  },
  {
    icon: IndianRupee, name: "Cash Command Center", tint: "#ECFDF5", ink: "#047857",
    lead: "One screen answers the question every owner asks daily: where is my money?",
    items: [
      { t: "Money in / money out", d: "Receivables and payables side by side, netted live." },
      { t: "Ageing buckets", d: "Current · 30d · 60d · 90+ — see who's late before it hurts." },
      { t: "Follow-ups", d: "Overdue invoices trigger follow-up tasks automatically." },
      { t: "Reminders", d: "One-click payment reminders by email and WhatsApp." },
      { t: "Transactions ledger", d: "Every rupee in and out, in one searchable list." },
    ],
  },
  {
    icon: Landmark, name: "GST, done for you", tint: "var(--lp-warn-tint)", ink: "#B45309",
    lead: "Your CA gets clean exports. You get your evenings back.",
    items: [
      { t: "Auto tax split", d: "CGST/SGST vs IGST decided from place of supply — never a wrong invoice." },
      { t: "HSN summary", d: "Printed on every invoice, exactly as the rules require." },
      { t: "GSTR-1 & 3B", d: "Monthly returns compiled automatically, exported as JSON for filing." },
      { t: "Dual numbering", d: "Separate GST and non-GST invoice series, per client." },
    ],
  },
  {
    icon: PackageSearch, name: "Buy & pay vendors", tint: "#EFF6FF", ink: "#1D4ED8",
    lead: "The mirror chain: procure-to-pay, with a 3-way match guarding every rupee out.",
    items: [
      { t: "Purchase Orders", d: "Raise POs to vendors with full line detail." },
      { t: "Goods Receipt Notes", d: "Record what actually arrived, against the PO." },
      { t: "Vendor Bills + 3-way match", d: "Bill vs PO vs GRN — mismatches surface before you pay." },
      { t: "Payables & Payment Run", d: "Ageing view of everything you owe, batched into scheduled payment runs." },
      { t: "Debit Notes", d: "Returns to vendors, documented properly." },
      { t: "Vendor ledger", d: "Every vendor's bills, payments and balance in one statement." },
    ],
  },
  {
    icon: Users, name: "People & payroll", tint: "#FDF4FF", ink: "#A21CAF",
    lead: "From offer to exit — salaries, statutory deductions and settlements computed for you.",
    items: [
      { t: "Employee records", d: "Joining, CTC, PF/ESI, TDS applicability — all in one profile." },
      { t: "Salary runs", d: "Basic/HRA/PF/PT/TDS computed monthly; payslips generated per employee." },
      { t: "Full & Final settlements", d: "Exit engine with §10(10)/§10(10AA) exemptions and notice recovery." },
      { t: "Asset tracking", d: "Laptops, phones, tools — issued, tracked, auto-recovered at exit." },
      { t: "ID cards", d: "Employee ID cards generated from the same records." },
      { t: "Payment vouchers", d: "Every payout documented and signed off." },
    ],
  },
  {
    icon: ShieldCheck, name: "Control & accountability", tint: "var(--lp-pain-tint)", ink: "#B91C1C",
    lead: "Know who created it, who changed it, who approved it. Always.",
    items: [
      { t: "Approval workflows", d: "Multi-step approvals on quotes, invoices, POs and payroll." },
      { t: "Audit log", d: "Every action recorded with before/after values." },
      { t: "Roles & permissions", d: "Per-module access. Staff see only what they need." },
      { t: "E-signatures", d: "Role-tagged signatures stamped on documents at approval." },
      { t: "Two-factor authentication", d: "2FA, login alerts and session control on every account." },
      { t: "Recycle bin", d: "Deleted by mistake? Restore it." },
    ],
  },
  {
    icon: Settings2, name: "Customization & settings", tint: "#F5F3FF", ink: "#7C3AED",
    lead: "Twelve settings surfaces make QuoteGen behave like it was built just for your business.",
    items: [
      { t: "Business Setup", d: "Logo, GSTIN, bank details and theme color — printed on every document." },
      { t: "Document numbering", d: "Your own prefixes and series, including dual GST / non-GST invoice numbering." },
      { t: "Users & invitations", d: "Invite staff by email; they get first-login password setup." },
      { t: "Custom roles", d: "Build roles with a per-module permission matrix." },
      { t: "Workflow designer", d: "Define who approves what, in what order, with e-sign steps." },
      { t: "Message templates", d: "Your own email and WhatsApp wording, with variables like amount and due date." },
      { t: "My Profile & Security", d: "Profile, password, 2FA, active sessions, login alerts." },
      { t: "Activity logs", d: "Every sign-in and security event, with IP and device." },
      { t: "API keys", d: "Scoped keys for integrations and reporting." },
      { t: "Privacy & Data (DPDP)", d: "Full data export and account deletion, on demand." },
      { t: "Billing controls", d: "Plan, GST-compliant subscription invoices, cancel anytime." },
      { t: "Accessibility", d: "Font scaling, contrast and reading aids, per user." },
    ],
  },
  {
    icon: Sparkles, name: "Everyday experience", tint: "#ECFEFF", ink: "#0E7490",
    lead: "The small things that make daily work fast — on any device.",
    items: [
      { t: "Global search (Ctrl+K)", d: "Find any client, invoice or project from one box." },
      { t: "Convert engine", d: "Quote → Order → Challan → Invoice with full document lineage." },
      { t: "Send by email & WhatsApp", d: "Documents go out from the app, PDF attached." },
      { t: "Notifications", d: "Approvals, payments and renewals ping you in-app." },
      { t: "Follow-ups & reminders", d: "Overdue work surfaces itself; one click chases it." },
      { t: "Notes & attachments", d: "Context and files pinned to every record." },
      { t: "Support tickets", d: "Built-in help desk when you need us." },
      { t: "Onboarding", d: "Guided setup gets you to your first document in minutes." },
      { t: "Works on mobile", d: "Every screen, full function, no app install." },
    ],
  },
];

const MORE = [
  { icon: FolderKanban, t: "Projects & pipeline", d: "Track deals and delivery work" },
  { icon: BookOpen, t: "Item catalog", d: "Reusable items with HSN & rates" },
  { icon: Repeat, t: "Subscriptions", d: "Recurring client billing" },
  { icon: BarChart3, t: "Reports", d: "Revenue, tax, ageing, payroll" },
  { icon: Bell, t: "Document vault", d: "Every file linked to its record" },
  { icon: Trash2, t: "Recycle bin", d: "Nothing is ever lost by accident" },
];

export default function FeaturesPage() {
  return (
    <MarketingShell active="/features">
      <PageHero kicker="Features"
        title={<>Everything your business runs on.<br /><span style={{ color: "var(--lp-brand-ink)" }}>Connected.</span></>}
        sub="Six modules, one workspace. Every capability below is live in the product today — no roadmap promises." />

      {/* Real outputs — same engine that generates customer documents */}
      <section className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-12">
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
          <div className="text-center max-w-[52ch] mx-auto">
            <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: "#B45309" }}>See the actual output</p>
            <h2 className="mt-2 text-[1.7rem] sm:text-[2.1rem] font-semibold leading-[1.05]" style={{ letterSpacing: "-0.03em" }}>
              Twelve real outputs — drag to see input vs result.
            </h2>
          </div>
          <div className="mt-6"><RealDocGallery /></div>
        </div>
      </section>

      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-16 space-y-6">
        {GROUPS.map((g, i) => (
          <motion.section key={g.name}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.04 * i, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-2xl p-6 sm:p-8"
            style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: g.tint }}>
                <g.icon size={19} strokeWidth={1.8} style={{ color: g.ink }} />
              </span>
              <div>
                <h2 className="text-[20px] sm:text-[24px] font-semibold" style={{ letterSpacing: "-0.02em" }}>{g.name}</h2>
                <p className="mt-1 text-[13.5px] max-w-[60ch]" style={{ color: "var(--lp-ink-soft)" }}>{g.lead}</p>
              </div>
            </div>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((it) => (
                <div key={it.t} className="rounded-xl p-4" style={{ background: "var(--lp-canvas)", border: "1px solid var(--lp-line-2)" }}>
                  <p className="text-[13.5px] font-semibold">{it.t}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>{it.d}</p>
                </div>
              ))}
            </div>
          </motion.section>
        ))}

        <section className="rounded-2xl p-6 sm:p-8" style={{ background: "var(--lp-brand-tint)", border: "1px solid var(--lp-line)" }}>
          <h2 className="text-[18px] font-semibold" style={{ letterSpacing: "-0.02em", color: "var(--lp-brand-ink)" }}>And the quiet workhorses</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {MORE.map((m) => (
              <div key={m.t} className="rounded-xl p-3.5" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line-2)" }}>
                <m.icon size={16} strokeWidth={1.8} style={{ color: "var(--lp-brand-ink)" }} />
                <p className="mt-2 text-[12.5px] font-semibold leading-tight">{m.t}</p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--lp-ink-soft)" }}>{m.d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
