"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Client, Quotation, Invoice, PaymentReceipt, SalaryRecord, Employee } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { BarChart3, TrendingUp, TrendingDown, IndianRupee, Users, Calendar, X, FileText, Receipt, Wallet, PieChart, ArrowUpRight, ArrowDownRight, Clock, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

interface ClientReport {
  name: string;
  quotations: number;
  invoices: number;
  totalBilled: number;
  totalPaid: number;
}

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allReceipts, setAllReceipts] = useState<PaymentReceipt[]>([]);
  const [allSalary, setAllSalary] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientReports, setClientReports] = useState<ClientReport[]>([]);
  const [totalBilled, setTotalBilled] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");

  // eslint-disable-next-line react-hooks/immutability -- hoisted function declaration, stable across renders
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [c, q, i, r, s, e] = await Promise.all([
      apiGet<Client[]>("/api/clients"),
      apiGet<Quotation[]>("/api/quotations"),
      apiGet<Invoice[]>("/api/invoices"),
      apiGet<PaymentReceipt[]>("/api/receipts"),
      apiGet<SalaryRecord[]>("/api/salary"),
      apiGet<Employee[]>("/api/employees"),
    ]);
    if (c) setClients(c);
    if (q) setAllQuotations(q);
    if (i) setAllInvoices(i);
    if (r) setAllReceipts(r);
    if (s) setAllSalary(s);
    if (e) setEmployees(e);
  }

  // Compute date range
  let from = dateFrom, to = dateTo;
  if (periodFilter === "this_month") {
    const now = new Date();
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  } else if (periodFilter === "last_month") {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  } else if (periodFilter === "this_quarter") {
    const now = new Date();
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    from = `${now.getFullYear()}-${String(qStart + 1).padStart(2, "0")}-01`;
    const qEnd = new Date(now.getFullYear(), qStart + 3, 0);
    to = `${qEnd.getFullYear()}-${String(qEnd.getMonth() + 1).padStart(2, "0")}-${String(qEnd.getDate()).padStart(2, "0")}`;
  } else if (periodFilter === "this_year") {
    from = `${new Date().getFullYear()}-01-01`;
    to = `${new Date().getFullYear()}-12-31`;
  }

  const invoices   = from ? allInvoices.filter((i)   => i.invoiceDate   >= from && i.invoiceDate   <= to) : allInvoices;
  const quotations = from ? allQuotations.filter((q) => q.quotationDate >= from && q.quotationDate <= to) : allQuotations;
  const receipts   = from ? allReceipts.filter((r)   => r.receiptDate   >= from && r.receiptDate   <= to) : allReceipts;
  const salary     = from ? allSalary.filter((s)     => s.createdAt     >= from && s.createdAt     <= to + "T23:59:59") : allSalary;

  const billed = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const paid   = receipts.reduce((s, r) => s + r.amount, 0);
  const outstanding = billed - paid;
  const totalSalaryPaid = salary.filter((s) => s.status === "Paid").reduce((s, r) => s + r.netSalary, 0);
  const netProfit = paid - totalSalaryPaid;

  // Quotation conversion rate
  const quotationsWon = quotations.filter((q) => q.status === "Won").length;
  const quotationsTotal = quotations.length;
  const conversionRate = quotationsTotal > 0 ? ((quotationsWon / quotationsTotal) * 100).toFixed(1) : "0";

  // Overdue invoices
  const today = new Date().toISOString().split("T")[0];
  const overdueInvoices = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled" && i.dueDate && i.dueDate < today);
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.totalAmount, 0);

  // Invoice status breakdown
  const invoicesByStatus = {
    paid: invoices.filter((i) => i.status === "Paid").length,
    unpaid: invoices.filter((i) => i.status === "Unpaid").length,
    overdue: overdueInvoices.length,
    draft: invoices.filter((i) => i.status === "Draft").length,
    partiallyPaid: invoices.filter((i) => i.status === "PartiallyPaid").length,
  };

  // Monthly revenue (last 6 months)
  const monthlyRevenue: { label: string; billed: number; received: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(); d.setMonth(d.getMonth() - m);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const mStart = `${yy}-${mm}-01`;
    const mEnd = `${yy}-${mm}-${String(new Date(yy, d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
    const mBilled = allInvoices.filter((i) => i.invoiceDate >= mStart && i.invoiceDate <= mEnd).reduce((s, i) => s + i.totalAmount, 0);
    const mReceived = allReceipts.filter((r) => r.receiptDate >= mStart && r.receiptDate <= mEnd).reduce((s, r) => s + r.amount, 0);
    monthlyRevenue.push({ label: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${yy}`, billed: mBilled, received: mReceived });
  }
  const maxMonthly = Math.max(...monthlyRevenue.map((m) => Math.max(m.billed, m.received)), 1);

  // Top clients
  const reports: ClientReport[] = clients
    .map((c) => ({
      name:        c.businessName,
      quotations:  quotations.filter((q) => q.clientId === c.id).length,
      invoices:    invoices.filter((i)   => i.clientId === c.id).length,
      totalBilled: invoices.filter((i)   => i.clientId === c.id).reduce((s, i) => s + i.totalAmount, 0),
      totalPaid:   receipts.filter((r)   => r.clientId === c.id).reduce((s, r) => s + r.amount, 0),
    }))
    .filter((r) => r.quotations > 0 || r.invoices > 0)
    .sort((a, b) => b.totalBilled - a.totalBilled);

  // Quotation status breakdown
  const quotationsByStatus = {
    won: quotationsWon,
    created: quotations.filter((q) => q.status === "Created").length,
    sent: quotations.filter((q) => q.status === "Sent").length,
    lost: quotations.filter((q) => q.status === "Lost").length,
    draft: quotations.filter((q) => q.status === "Draft").length,
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  const STAT_CARDS = [
    { label: "Total Billed",   value: billed,           icon: IndianRupee,    iconBg: "#EEF2FF", iconColor: "#4F46E5", accent: "#4F46E5", border: "#C7D2FE" },
    { label: "Total Received", value: paid,             icon: TrendingUp,     iconBg: "#ECFDF5", iconColor: "#059669", accent: "#059669", border: "#A7F3D0" },
    { label: "Outstanding",    value: outstanding,      icon: BarChart3,      iconBg: "#FEF2F2", iconColor: "#DC2626", accent: "#DC2626", border: "#FECACA" },
    { label: "Overdue",        value: overdueAmount,    icon: Clock,          iconBg: "#FFFBEB", iconColor: "#D97706", accent: "#D97706", border: "#FDE68A" },
    { label: "Salary Expenses",value: totalSalaryPaid,  icon: Wallet,         iconBg: "#FFF7ED", iconColor: "#EA580C", accent: "#EA580C", border: "#FED7AA" },
    { label: "Net Profit",     value: netProfit,        icon: netProfit >= 0 ? ArrowUpRight : ArrowDownRight, iconBg: netProfit >= 0 ? "#ECFDF5" : "#FEF2F2", iconColor: netProfit >= 0 ? "#059669" : "#DC2626", accent: netProfit >= 0 ? "#059669" : "#DC2626", border: netProfit >= 0 ? "#A7F3D0" : "#FECACA" },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Business analytics and performance overview"
        action={
          <button
            onClick={() => {
              downloadCSV(
                `report-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Client", "Quotations", "Invoices", "Total Billed", "Total Paid", "Outstanding"],
                clientReports.map((r) => [r.name, r.quotations, r.invoices, r.totalBilled, r.totalPaid, r.totalBilled - r.totalPaid])
              );
            }}
            className="btn btn-outline"
          >
            <Download size={14} /> Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={periodFilter}
              onChange={(e) => { setPeriodFilter(e.target.value); if (e.target.value) { setDateFrom(""); setDateTo(""); } }}
              className="inp"
              style={{ width: 160, height: 36, fontSize: 13 }}
            >
              <option value="">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[12px] font-medium">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPeriodFilter(""); }}
              className="inp"
              style={{ height: 36, width: 140, fontSize: 13 }}
            />
            <span className="text-slate-400 text-[12px] font-medium">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPeriodFilter(""); }}
              className="inp"
              style={{ height: 36, width: 140, fontSize: 13 }}
            />
          </div>
          {(dateFrom || dateTo || periodFilter) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setPeriodFilter(""); }}
              className="btn btn-danger-soft btn-sm"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="p-3 sm:p-[18px_20px]" style={{
            background: "#fff",
            border: `1.5px solid ${card.border}`,
            borderLeft: `4px solid ${card.accent}`,
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)",
          }}>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center justify-center shrink-0" style={{
                width: 42, height: 42, borderRadius: 10,
                background: card.iconBg,
              }}>
                <card.icon size={19} color={card.iconColor} strokeWidth={2} />
              </div>
              <div>
                <div className="text-[10px] sm:text-[11.5px] text-slate-500 font-medium">{card.label}</div>
                <div className="nums text-[16px] sm:text-[20px]" style={{ fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em", lineHeight: 1.3 }}>
                  {fmt(card.value)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart + Pipeline Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Revenue Bar Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={15} className="text-indigo-500" />
            <span className="font-bold text-slate-900 text-[14px]">Monthly Revenue (Last 6 Months)</span>
          </div>
          <div className="flex items-end gap-3" style={{ height: 180 }}>
            {monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: 150 }}>
                  <div className="flex-1 rounded-t-sm" style={{ height: `${(m.billed / maxMonthly) * 100}%`, background: "#C7D2FE", minHeight: m.billed > 0 ? 4 : 0 }} title={`Billed: ${fmt(m.billed)}`} />
                  <div className="flex-1 rounded-t-sm" style={{ height: `${(m.received / maxMonthly) * 100}%`, background: "#059669", minHeight: m.received > 0 ? 4 : 0 }} title={`Received: ${fmt(m.received)}`} />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{m.label.split(" ")[0]}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#C7D2FE" }} /> Billed
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#059669" }} /> Received
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <PieChart size={15} className="text-indigo-500" />
            <span className="font-bold text-slate-900 text-[14px]">Quick Insights</span>
          </div>

          {/* Quotation Pipeline */}
          <div className="p-3 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Quotations</div>
            <div className="text-[20px] font-bold text-slate-900 nums mb-2">{quotationsTotal}</div>
            <div className="flex flex-wrap gap-1.5">
              {quotationsByStatus.won > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{quotationsByStatus.won} Won</span>}
              {quotationsByStatus.sent > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{quotationsByStatus.sent} Sent</span>}
              {quotationsByStatus.created > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{quotationsByStatus.created} Created</span>}
              {quotationsByStatus.lost > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold">{quotationsByStatus.lost} Lost</span>}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Conversion Rate: <b className="text-indigo-600">{conversionRate}%</b></div>
          </div>

          {/* Invoice Pipeline */}
          <div className="p-3 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Invoices</div>
            <div className="text-[20px] font-bold text-slate-900 nums mb-2">{invoices.length}</div>
            <div className="flex flex-wrap gap-1.5">
              {invoicesByStatus.paid > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{invoicesByStatus.paid} Paid</span>}
              {invoicesByStatus.unpaid > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{invoicesByStatus.unpaid} Unpaid</span>}
              {invoicesByStatus.overdue > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold">{invoicesByStatus.overdue} Overdue</span>}
              {invoicesByStatus.partiallyPaid > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{invoicesByStatus.partiallyPaid} Partial</span>}
              {invoicesByStatus.draft > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{invoicesByStatus.draft} Draft</span>}
            </div>
          </div>

          {/* Team */}
          <div className="p-3 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Team</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[20px] font-bold text-slate-900 nums">{employees.length}</span>
              <span className="text-[11px] text-slate-400">employees</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active: <b className="text-emerald-600">{employees.filter((e) => e.status === "Active").length}</b> ·
              Monthly Payroll: <b className="text-slate-700">{fmt(employees.filter((e) => e.status === "Active").reduce((s, e) => s + e.salary, 0))}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EAECF0]" style={{ background: "#FEF2F2" }}>
            <Clock size={15} className="text-red-500" />
            <span className="font-bold text-red-800 text-[14px]">Overdue Invoices ({overdueInvoices.length})</span>
            <span className="ml-auto text-[13px] font-bold text-red-600 nums">{fmt(overdueAmount)}</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Due Date</th>
                  <th className="right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.slice(0, 10).map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-semibold text-indigo-600 text-[13px]">{inv.invoiceNo}</td>
                    <td className="text-[13px]">{inv.clientName}</td>
                    <td className="text-[13px] text-red-600 font-medium">{inv.dueDate}</td>
                    <td className="text-right font-semibold nums text-[13px]">{fmt(inv.totalAmount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client Report Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EAECF0]" style={{ background: "#FAFBFD" }}>
          <Users size={15} className="text-indigo-500" />
          <span className="font-bold text-slate-900 text-[14px]">Client-wise Report</span>
          <span className="ml-auto text-[12px] text-slate-400">{reports.length} clients</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Client</th>
                <th className="right">Quotations</th>
                <th className="right">Invoices</th>
                <th className="right">Total Billed</th>
                <th className="right">Received</th>
                <th className="right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <div className="empty-icon"><BarChart3 size={20} /></div>
                      <p className="text-[13px] text-slate-400">No data for the selected period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {reports.map((r, i) => (
                    <tr key={r.name}>
                      <td className="text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                      <td className="font-semibold text-slate-900 text-[13px]">{r.name}</td>
                      <td className="text-right text-[13px]">{r.quotations}</td>
                      <td className="text-right text-[13px]">{r.invoices}</td>
                      <td className="text-right font-semibold nums text-[13px]">
                        {fmt(r.totalBilled)}
                      </td>
                      <td className="text-right font-semibold nums text-emerald-600 text-[13px]">
                        {fmt(r.totalPaid)}
                      </td>
                      <td className="text-right font-semibold nums text-rose-600 text-[13px]">
                        {fmt(r.totalBilled - r.totalPaid)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: "#F7F8FC", borderTop: "2px solid #E8EAEF" }}>
                    <td colSpan={2} className="font-bold text-slate-700 text-[13px]">Total</td>
                    <td className="text-right font-bold text-[13px]">{reports.reduce((s, r) => s + r.quotations, 0)}</td>
                    <td className="text-right font-bold text-[13px]">{reports.reduce((s, r) => s + r.invoices, 0)}</td>
                    <td className="text-right font-bold nums text-[13px]">{fmt(reports.reduce((s, r) => s + r.totalBilled, 0))}</td>
                    <td className="text-right font-bold nums text-emerald-600 text-[13px]">{fmt(reports.reduce((s, r) => s + r.totalPaid, 0))}</td>
                    <td className="text-right font-bold nums text-rose-600 text-[13px]">{fmt(reports.reduce((s, r) => s + (r.totalBilled - r.totalPaid), 0))}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
