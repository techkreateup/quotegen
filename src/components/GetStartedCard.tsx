"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Rocket, X } from "lucide-react";

// Adaptive dashboard onboarding checklist (Track E-polish). Fetches the
// server-side checklist snapshot and lays it out with incomplete-first ordering
// so the user always sees the next best action at the top. Auto-hides once
// everything is done. User can dismiss via localStorage.

interface Checklist {
  hasClient: boolean;
  hasQuotation: boolean;
  hasTeamMember: boolean;
  setupCompleted: boolean;
  hasBranding: boolean;
  hasInvoice: boolean;
  hasPayment: boolean;
  hasEmployee: boolean;
  hasVendor: boolean;
}

interface Item { key: keyof Checklist; label: string; hint: string; href: string; priority: number }

const ITEMS: Item[] = [
  { key: "setupCompleted", label: "Tailor your workspace",     hint: "3-question wizard — hide docs you don't need",     href: "/settings/business-setup", priority: 0 },
  { key: "hasBranding",    label: "Add logo & business details", hint: "Appears on every PDF you send",                     href: "/settings",                priority: 1 },
  { key: "hasClient",      label: "Add your first client",       hint: "GSTIN, contacts, addresses",                        href: "/clients/new",             priority: 2 },
  { key: "hasQuotation",   label: "Create a quotation",          hint: "Build with line items, GST, discounts",            href: "/quotations/new",          priority: 3 },
  { key: "hasInvoice",     label: "Issue an invoice",            hint: "One click converts a won quote to a GST invoice",  href: "/invoices",                priority: 4 },
  { key: "hasPayment",     label: "Record a payment",            hint: "Receipts + ledger update automatically",           href: "/payment-receipts",        priority: 5 },
  { key: "hasEmployee",    label: "Add an employee",             hint: "Unlocks salary + F&F + ID cards",                   href: "/employees/new",           priority: 6 },
  { key: "hasVendor",      label: "Add a vendor",                hint: "Track bills, payments, debit notes",                href: "/vendors",                 priority: 7 },
  { key: "hasTeamMember",  label: "Invite a teammate",           hint: "Assign roles per module",                           href: "/settings/users",          priority: 8 },
];

const DISMISS_KEY = "quotegen.getstarted.dismissed";

export default function GetStartedCard() {
  const [list, setList] = useState<Checklist | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true); } catch {}
    fetch("/api/onboarding").then(r => r.json()).then(d => setList(d.checklist)).catch(() => {});
  }, []);

  if (!list || dismissed) return null;

  const rows = ITEMS.map(i => ({ ...i, done: !!list[i.key] }));
  const done = rows.filter(r => r.done).length;
  const total = rows.length;
  const pct = Math.round((done / total) * 100);
  if (done === total) return null;

  // Order: incomplete first (by priority), then complete (as a "done" strip).
  const ordered = [
    ...rows.filter(r => !r.done).sort((a, b) => a.priority - b.priority),
    ...rows.filter(r => r.done).sort((a, b) => a.priority - b.priority),
  ];

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}>
            <Rocket size={14} color="white" />
          </span>
          <div>
            <div className="text-[13.5px] font-bold text-slate-900">Get started with QuoteGen</div>
            <div className="text-[11.5px] text-slate-500">{done} of {total} done · takes about 5 minutes</div>
          </div>
        </div>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Dismiss"><X size={14} /></button>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#10B981,#6366F1)" }} />
      </div>

      <ul className="mt-3 space-y-1.5">
        {ordered.slice(0, 6).map(r => (
          <li key={r.key}>
            {r.done ? (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span className="text-[12.5px] text-slate-400 line-through">{r.label}</span>
              </div>
            ) : (
              <Link href={r.href} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 group">
                <Circle size={16} className="text-slate-300 shrink-0 group-hover:text-indigo-400 transition-colors" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-800 group-hover:text-indigo-600">{r.label}</div>
                  <div className="text-[11.5px] text-slate-400">{r.hint}</div>
                </div>
                <span className="ml-auto text-[11.5px] font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Start →</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
