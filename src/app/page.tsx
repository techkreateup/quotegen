"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/store";
import { Invoice, Quotation } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, ArrowUpRight, IndianRupee, TrendingUp,
  AlertTriangle, Users, Briefcase, FolderKanban, RefreshCw, Package,
  Clock, FileText, ChevronRight, ChevronDown, Copy, ClipboardCheck,
} from "lucide-react";
import PermissionGate from "@/components/PermissionGate";
import GetStartedCard from "@/components/GetStartedCard";
import { usePermissions } from "@/components/AuthProvider";
import { hasPermission } from "@/lib/permissions";

interface DashboardData {
  pendingApprovals: number;
  stats: {
    totalRevenue: number; paidAmount: number; unpaidAmount: number; thisMonthRevenue: number;
    totalClients: number; totalEmployees: number; activeProjects: number; activeSubscriptions: number;
    totalVendors: number; totalInvoices: number; totalQuotations: number;
    quotationsWon: number; quotationsPending: number; salaryPending: number;
    overdueInvoices: number; upcomingRenewals: number;
  };
  monthlyTrend: { month: string; label: string; income: number; expense: number }[];
  expenseByType: Record<string, number>;
}

const EXPENSE_COLORS: Record<string, string> = {
  Salary: "#6366F1", Subscription: "#A855F7", VendorPayment: "#F97316",
  OfficeExpense: "#EAB308", Miscellaneous: "#94A3B8",
};
const EXPENSE_LABELS: Record<string, string> = {
  Salary: "Salary", Subscription: "Subscriptions", VendorPayment: "Vendors",
  OfficeExpense: "Office", Miscellaneous: "Other",
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN"); }
function fmtShort(n: number) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + n.toLocaleString("en-IN");
}

type Period = "this_month" | "last_month" | "this_quarter" | "this_year" | "all_time";
const PERIODS: { key: Period; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "all_time", label: "All Time" },
];

const PERIOD_LABELS: Record<Period, string> = {
  this_month: "This Month", last_month: "Last Month", this_quarter: "This Quarter",
  this_year: "This Year", all_time: "All Time",
};

type SortOption = "newest" | "oldest" | "amount_high" | "amount_low";
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "amount_high", label: "Amount: High to Low" },
  { key: "amount_low", label: "Amount: Low to High" },
];

function sortItems<T extends { createdAt: string; totalAmount: number }>(items: T[], sort: SortOption): T[] {
  const sorted = [...items];
  switch (sort) {
    case "newest": return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest": return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "amount_high": return sorted.sort((a, b) => b.totalAmount - a.totalAmount);
    case "amount_low": return sorted.sort((a, b) => a.totalAmount - b.totalAmount);
  }
}

/* ── Area chart for cash flow ── */
function AreaChart({ data }: { data: DashboardData["monthlyTrend"] }) {
  if (!data.length) return null;
  const W = 500; const H = 140; const PX = 46; const PY = 16;
  const chartW = W - PX * 2; const chartH = H - PY * 2;
  const allVals = data.flatMap(d => [d.income, d.expense]);
  const max = Math.max(...allVals, 1);
  const step = chartW / (data.length - 1 || 1);

  const toY = (v: number) => PY + chartH - (v / max) * chartH;
  const incomePoints = data.map((d, i) => `${PX + i * step},${toY(d.income)}`).join(" ");
  const expensePoints = data.map((d, i) => `${PX + i * step},${toY(d.expense)}`).join(" ");
  const incomeArea = `${PX},${PY + chartH} ${incomePoints} ${PX + (data.length - 1) * step},${PY + chartH}`;
  const expenseArea = `${PX},${PY + chartH} ${expensePoints} ${PX + (data.length - 1) * step},${PY + chartH}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = PY + chartH * (1 - pct);
    const val = max * pct;
    return { y, label: fmtShort(val) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: "block" }}>
      {gridLines.map(g => (
        <g key={g.y}>
          <line x1={PX} y1={g.y} x2={W - PX} y2={g.y} stroke="#F1F5F9" strokeWidth={1} />
          <text x={PX - 6} y={g.y + 3} textAnchor="end" fontSize="10" fill="#C4C9D9" fontWeight="500">{g.label}</text>
        </g>
      ))}
      <polygon points={incomeArea} fill="url(#incGrad)" opacity={0.18} />
      <polygon points={expenseArea} fill="url(#expGrad)" opacity={0.12} />
      <polyline points={incomePoints} fill="none" stroke="#059669" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={expensePoints} fill="none" stroke="#E11D48" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
      {data.map((d, i) => {
        const cx = PX + i * step;
        const iy = toY(d.income);
        const ey = toY(d.expense);
        return (
          <g key={d.month}>
            <circle cx={cx} cy={iy} r={3.5} fill="#059669" stroke="#fff" strokeWidth={1.5} />
            <circle cx={cx} cy={ey} r={3} fill="#E11D48" stroke="#fff" strokeWidth={1.5} />
            {/* Show values by default */}
            {d.income > 0 && <text x={cx} y={iy - 8} textAnchor="middle" fontSize="9" fill="#059669" fontWeight="600">{fmtShort(d.income)}</text>}
            {d.expense > 0 && <text x={cx} y={ey + 14} textAnchor="middle" fontSize="9" fill="#E11D48" fontWeight="600">{fmtShort(d.expense)}</text>}
            <text x={cx} y={H + 18} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontWeight="500">{d.label}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Horizontal expense bars ── */
function ExpenseBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 24 }}>No expenses recorded</div>;
  const max = entries[0][1];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map(([key, val]) => {
        const pct = Math.round((val / total) * 100);
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, minWidth: 0, gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{EXPENSE_LABELS[key] || key}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(val)} <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>({pct}%)</span></span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: "#F1F5F9", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(val / max) * 100}%`, background: EXPENSE_COLORS[key] || "#94A3B8", borderRadius: 4, transition: "width 600ms ease" }} />
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Total Expenses</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{fmt(total)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { permissions, isSystemAdmin } = usePermissions();
  const can = (mod: string, action: string = "view") => isSystemAdmin || hasPermission(permissions, mod as Parameters<typeof hasPermission>[1], action as Parameters<typeof hasPermission>[2]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [period, setPeriod] = useState<Period>("all_time");
  const [quotationSort, setQuotationSort] = useState<SortOption>("newest");
  const [invoiceSort, setInvoiceSort] = useState<SortOption>("newest");
  const [onboardingPending, setOnboardingPending] = useState(false);

  useEffect(() => {
    // Show a resume banner if onboarding was started but never finished
    apiGet<{ progress: { completedAt: string | null; skippedAt: string | null } }>("/api/onboarding")
      .then((d) => setOnboardingPending(!d.progress?.completedAt && !d.progress?.skippedAt))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [dash, invRes, qtRes] = await Promise.all([
          apiGet<DashboardData>(`/api/dashboard?period=${period}`),
          apiGet<Invoice[] | { data: Invoice[] }>("/api/invoices"),
          apiGet<Quotation[] | { data: Quotation[] }>("/api/quotations"),
        ]);
        setData(dash);
        const inv = Array.isArray(invRes) ? invRes : invRes.data;
        const qt = Array.isArray(qtRes) ? qtRes : qtRes.data;
        setInvoices(inv.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
        setQuotations(qt.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
      } catch {}
    })();
  }, [period]);

  const s = data?.stats;
  const totalExpenses = data ? Object.values(data.expenseByType).reduce((a, b) => a + b, 0) : 0;
  const netProfit = (s?.paidAmount ?? 0) - totalExpenses;

  const sortedQuotations = sortItems(quotations, quotationSort);
  const sortedInvoices = sortItems(invoices, invoiceSort);

  const urgentActions: { label: string; detail: string; href: string; icon: typeof AlertTriangle; color: string; bg: string; border: string; priority: number }[] = [];
  if (s?.overdueInvoices && can("invoices")) urgentActions.push({ label: "Overdue Invoices", detail: `${s.overdueInvoices} need follow-up`, href: "/invoices", icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5", priority: 1 });
  if (s?.salaryPending && can("salary")) urgentActions.push({ label: "Pending Salaries", detail: `${s.salaryPending} awaiting payment`, href: "/salary", icon: Clock, color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", priority: 2 });
  if (s?.upcomingRenewals && can("subscriptions")) urgentActions.push({ label: "Renewals Due", detail: `${s.upcomingRenewals} this week`, href: "/subscriptions", icon: RefreshCw, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", priority: 3 });
  if (s?.quotationsPending && can("quotations")) urgentActions.push({ label: "Attention Quotes", detail: `${s.quotationsPending} awaiting response`, href: "/quotations", icon: FileText, color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD", priority: 4 });
  if (data?.pendingApprovals) urgentActions.push({ label: "Pending Approvals", detail: `${data.pendingApprovals} items need your review`, href: "/approvals", icon: ClipboardCheck, color: "#059669", bg: "#ECFDF5", border: "#6EE7B7", priority: 0 });

  return (
    <div className="w-full space-y-5">

      <GetStartedCard />

      {onboardingPending && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm text-indigo-900">
            <span className="font-semibold">Finish setting up your workspace</span> — complete your
            company profile and invite your team.
          </p>
          <div className="flex gap-2 shrink-0">
            <Link href="/onboarding" className="h-9 px-4 inline-flex items-center rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              Resume setup
            </Link>
            <button
              onClick={async () => {
                setOnboardingPending(false);
                await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skipped: true }) });
              }}
              className="h-9 px-3 inline-flex items-center rounded-lg text-xs font-semibold text-indigo-500 hover:text-indigo-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500, marginBottom: 2 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em" }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <PermissionGate module="quotations" action="create"><Link href="/quotations/new" className="btn btn-outline"><Plus size={14} /> Quotation</Link></PermissionGate>
          <PermissionGate module="invoices" action="create"><Link href="/invoices/new" className="btn btn-primary"><Plus size={14} /> Invoice</Link></PermissionGate>
        </div>
      </div>

      {/* 2. URGENT ACTIONS */}
      {urgentActions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {urgentActions.sort((a, b) => a.priority - b.priority).map(a => (
            <Link key={a.label} href={a.href} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14,
              background: a.bg, border: `1.5px solid ${a.border}`, textDecoration: "none", transition: "all 200ms",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${a.color}15`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 1px 3px ${a.color}20`, flexShrink: 0 }}>
                <a.icon size={17} color={a.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</div>
              </div>
              <ChevronRight size={14} color={a.color} style={{ opacity: 0.5, flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}

      {/* 3. QUICK NAV STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: "Clients", val: s?.totalClients ?? 0, icon: Users, href: "/clients", color: "#4F46E5", mod: "clients" },
          { label: "Employees", val: s?.totalEmployees ?? 0, icon: Briefcase, href: "/employees", color: "#7C3AED", mod: "employees" },
          { label: "Projects", val: s?.activeProjects ?? 0, icon: FolderKanban, href: "/projects", color: "#059669", mod: "projects" },
          { label: "Vendors", val: s?.totalVendors ?? 0, icon: Package, href: "/vendors", color: "#EA580C", mod: "vendors" },
          { label: "Subscriptions", val: s?.activeSubscriptions ?? 0, icon: RefreshCw, href: "/subscriptions", color: "#0891B2", mod: "subscriptions" },
          { label: "Quotations", val: s?.totalQuotations ?? 0, icon: FileText, href: "/quotations", color: "#6366F1", mod: "quotations" },
        ].filter(m => can(m.mod)).map(m => (
          <Link key={m.label} href={m.href} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12,
            background: "#fff", border: "1.5px solid #E5E7EB", textDecoration: "none", transition: "all 180ms",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = m.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${m.color}12`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <m.icon size={16} color={m.color} strokeWidth={2} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{m.val}</div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 500 }}>{m.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* A) PERIOD FILTER PILLS */}
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-x-visible">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, minHeight: 36,
              border: period === p.key ? "1.5px solid #4F46E5" : "1.5px solid #E5E7EB",
              background: period === p.key ? "#EEF2FF" : "#fff",
              color: period === p.key ? "#4338CA" : "#6B7280",
              cursor: "pointer", transition: "all 150ms",
            }}
          >
            {p.label}
          </button>
        ))}
        {period !== "all_time" && (
          <Link href={`/reports?period=${period}`} style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", textDecoration: "none", marginLeft: 4, display: "flex", alignItems: "center", gap: 3 }}>
            View Reports <ArrowUpRight size={11} />
          </Link>
        )}
      </div>

      {/* 4. FINANCIAL OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue */}
        {can("invoices") && (
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #E2E5EF", padding: "24px", boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Revenue <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", textTransform: "none", letterSpacing: "normal" }}>({PERIOD_LABELS[period]})</span>
            </span>
            <Link href="/reports" style={{ fontSize: 11.5, fontWeight: 600, color: "#4F46E5", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              Reports <ArrowUpRight size={11} />
            </Link>
          </div>
          <div style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {fmt(s?.totalRevenue ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>{s?.totalInvoices ?? 0} invoices · {s?.totalClients ?? 0} clients</div>

          <div style={{ height: 1, background: "#F1F5F9", margin: "18px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginBottom: 3 }}>Collected</div>
              <div style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums", overflowWrap: "break-word" }}>{fmtShort(s?.paidAmount ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: s?.unpaidAmount ? "#DC2626" : "#9CA3AF", fontWeight: 600, marginBottom: 3 }}>Outstanding</div>
              <div style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 800, color: s?.unpaidAmount ? "#DC2626" : "#059669", fontVariantNumeric: "tabular-nums", overflowWrap: "break-word" }}>{fmtShort(s?.unpaidAmount ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#4F46E5", fontWeight: 600, marginBottom: 3 }}>This Month</div>
              <div style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 800, color: "#4F46E5", fontVariantNumeric: "tabular-nums", overflowWrap: "break-word" }}>{fmtShort(s?.thisMonthRevenue ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: netProfit >= 0 ? "#059669" : "#DC2626", fontWeight: 600, marginBottom: 3 }}>Net Profit</div>
              <div style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 800, color: netProfit >= 0 ? "#059669" : "#DC2626", fontVariantNumeric: "tabular-nums", overflowWrap: "break-word" }}>
                {netProfit >= 0 ? "" : "-"}{fmtShort(Math.abs(netProfit))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Expenses */}
        {can("transactions") && (
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #E2E5EF", padding: "24px", boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>Expenses</span>
            <Link href="/transactions" style={{ fontSize: 11.5, fontWeight: 600, color: "#4F46E5", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              All transactions <ArrowUpRight size={11} />
            </Link>
          </div>
          {data?.expenseByType ? <ExpenseBars data={data.expenseByType} /> : <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>Loading...</div>}
        </div>
        )}
      </div>

      {/* 5. RECENT QUOTATIONS + INVOICES with sort + duplicate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {([
          ...(can("quotations") ? [{ title: "Latest Quotations", link: "/quotations", items: sortedQuotations, sort: quotationSort, setSort: setQuotationSort, cloneBase: "/quotations/new?clone=", no: (i: Quotation) => i.quotationNo, href: (i: Quotation) => `/quotations/view?id=${i.id}`, date: (i: Quotation) => i.quotationDate, amount: (i: Quotation) => i.totalAmount, status: (i: Quotation) => i.status, client: (i: Quotation) => i.clientName }] : []),
          ...(can("invoices") ? [{ title: "Latest Invoices", link: "/invoices", items: sortedInvoices, sort: invoiceSort, setSort: setInvoiceSort, cloneBase: "/invoices/new?clone=", no: (i: Invoice) => i.invoiceNo, href: (i: Invoice) => `/invoices/view?id=${i.id}`, date: (i: Invoice) => i.invoiceDate, amount: (i: Invoice) => i.totalAmount, status: (i: Invoice) => i.status, client: (i: Invoice) => i.clientName }] : []),
        ] as {
          title: string; link: string; items: (Quotation | Invoice)[];
          sort: SortOption; setSort: (s: SortOption) => void; cloneBase: string;
          no: (i: Quotation & Invoice) => string; href: (i: Quotation & Invoice) => string;
          date: (i: Quotation & Invoice) => string; amount: (i: Quotation & Invoice) => number;
          status: (i: Quotation & Invoice) => string; client: (i: Quotation & Invoice) => string;
        }[]).map((panel) => (
          <div key={panel.title} style={{ background: "#fff", border: "1.5px solid #E2E5EF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{panel.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Sort dropdown */}
                <select
                  value={panel.sort}
                  onChange={e => panel.setSort(e.target.value as SortOption)}
                  style={{ fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 6, padding: "6px 8px", color: "#6B7280", background: "#fff", outline: "none", cursor: "pointer", minHeight: 36 }}
                >
                  {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <Link href={panel.link} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#4F46E5", textDecoration: "none", whiteSpace: "nowrap" }}>
                  View all <ChevronRight size={12} />
                </Link>
              </div>
            </div>
            {panel.items.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>No records yet</div>
            ) : panel.items.map((item) => (
              <div
                key={item.id}
                className="group"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F8FAFC", transition: "background 120ms" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFF"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <Link href={panel.href(item as Quotation & Invoice)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0 11px 20px", textDecoration: "none", flex: 1, minWidth: 0 }}
                >
                  <div style={{ minWidth: 0, marginRight: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>
                      <span style={{ color: "#4F46E5", fontWeight: 700 }}>{panel.no(item as Quotation & Invoice)}</span>
                      <span style={{ color: "#D1D5E0", margin: "0 6px" }}>·</span>
                      {panel.client(item as Quotation & Invoice)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{formatDate(panel.date(item as Quotation & Invoice))}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmt(panel.amount(item as Quotation & Invoice))}</span>
                    <StatusBadge status={panel.status(item as Quotation & Invoice)} />
                  </div>
                </Link>
                {/* Duplicate button */}
                <button
                  onClick={() => router.push(`${panel.cloneBase}${item.id}`)}
                  className="max-sm:opacity-100 opacity-0 group-hover:opacity-100"
                  style={{ padding: "10px 12px", background: "none", border: "none", cursor: "pointer", transition: "opacity 150ms", flexShrink: 0 }}
                  title="Duplicate"
                >
                  <Copy size={13} color="#9CA3AF" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 6. CASH FLOW */}
      {can("transactions") && (
      <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #E2E5EF", padding: "20px 24px", boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Cash Flow Trend</span>
            <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 8 }}>Last 6 months</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: "#059669" }} /> Income</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: "#E11D48", opacity: 0.7 }} /> Expense</span>
          </div>
        </div>
        {data?.monthlyTrend ? <AreaChart data={data.monthlyTrend} /> : <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>Loading...</div>}
      </div>
      )}
    </div>
  );
}
