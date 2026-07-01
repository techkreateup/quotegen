"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Quotation, SalesOrder, DeliveryChallan, Invoice, Client } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import { TrendingUp, AlertTriangle, Wallet, Clock } from "lucide-react";

// D3 — sell-side pipeline as a DECISION tool (industry pattern: weighted value per
// stage + aging/stale flags + KPI summary, not a flat card list). Each open
// document sits in the lifecycle stage it currently occupies:
// Lead → Quoted → Sales Order → Delivered → Invoiced → Paid.

type Card = {
  id: string; href: string; no: string; client: string; amount: number;
  days: number;            // days in stage (age)
  flag?: "stale" | "overdue";
  sub?: string;
};
type Col = { key: string; label: string; color: string; prob: number; staleDays: number; cards: Card[] };

const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const daysAgo = (d?: string) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);
const arr = <T,>(d: T[] | { data: T[] } | null): T[] => (Array.isArray(d) ? d : d?.data ?? []);

export default function PipelinePage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    Promise.all([
      apiGet<Client[]>("/api/clients").then(d => setClients(arr(d))).catch(() => {}),
      apiGet<Quotation[]>("/api/quotations").then(d => setQuotes(arr(d))).catch(() => {}),
      apiGet<SalesOrder[]>("/api/sales-orders").then(d => setOrders(arr(d))).catch(() => {}),
      apiGet<DeliveryChallan[]>("/api/delivery-challans").then(d => setChallans(arr(d))).catch(() => {}),
      apiGet<Invoice[]>("/api/invoices").then(d => setInvoices(arr(d))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const columns: Col[] = useMemo(() => {
    const engaged = new Set<string>();
    [...quotes, ...orders, ...invoices].forEach(d => d.clientId && engaged.add(d.clientId));

    const leads: Card[] = clients
      .filter(c => c.status !== "Inactive" && !engaged.has(c.id))
      .map(c => ({ id: c.id, href: "/clients", no: c.businessName, client: c.businessName, amount: 0, days: daysAgo(c.createdAt) }));

    const quoted: Card[] = quotes
      .filter(q => !["Won", "Lost", "Cancelled"].includes(q.status))
      .map(q => {
        const days = daysAgo(q.createdAt);
        return { id: q.id, href: `/quotations/view?id=${q.id}`, no: q.quotationNo, client: q.clientName, amount: q.totalAmount, days, flag: days > 14 ? "stale" as const : undefined, sub: q.docType === "Proforma" ? "Proforma" : undefined };
      });

    const so: Card[] = orders
      .filter(o => ["Draft", "Open", "PartiallyDelivered", "PendingApproval"].includes(o.status))
      .map(o => {
        const days = daysAgo(o.createdAt);
        return { id: o.id, href: `/sales-orders/view?id=${o.id}`, no: o.salesOrderNo, client: o.clientName, amount: o.totalAmount, days, flag: days > 21 ? "stale" as const : undefined, sub: o.clientPoNumber ? `PO ${o.clientPoNumber}` : undefined };
      });

    const delivered: Card[] = challans
      .filter(c => c.status !== "Cancelled" && c.status !== "Invoiced")
      .map(c => {
        const days = daysAgo(c.createdAt);
        return { id: c.id, href: `/delivery-challans/view?id=${c.id}`, no: c.challanNo, client: c.clientName, amount: c.totalAmount, days, flag: days > 7 ? "stale" as const : undefined, sub: c.challanType };
      });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const invoiced: Card[] = invoices
      .filter(i => ["Draft", "Unpaid", "Overdue", "PartiallyPaid", "PendingApproval"].includes(i.status))
      .map(i => {
        const overdue = i.status === "Overdue" || (!!i.dueDate && new Date(i.dueDate) < today);
        return { id: i.id, href: `/invoices/view?id=${i.id}`, no: i.invoiceNo, client: i.clientName, amount: i.totalAmount, days: daysAgo(i.createdAt), flag: overdue ? "overdue" as const : undefined, sub: overdue && i.dueDate ? `Due ${i.dueDate}` : i.status };
      });

    const paid: Card[] = invoices
      .filter(i => i.status === "Paid")
      .map(i => ({ id: i.id, href: `/invoices/view?id=${i.id}`, no: i.invoiceNo, client: i.clientName, amount: i.totalAmount, days: daysAgo(i.paymentDate || i.createdAt) }));

    return [
      { key: "lead", label: "Leads", color: "#64748B", prob: 0.1, staleDays: 30, cards: leads },
      { key: "quoted", label: "Quoted", color: "#6366F1", prob: 0.3, staleDays: 14, cards: quoted },
      { key: "so", label: "Sales Order", color: "#8B5CF6", prob: 0.7, staleDays: 21, cards: so },
      { key: "delivered", label: "Delivered", color: "#0EA5E9", prob: 0.85, staleDays: 7, cards: delivered },
      { key: "invoiced", label: "Invoiced", color: "#F59E0B", prob: 0.95, staleDays: 0, cards: invoiced },
      { key: "paid", label: "Paid", color: "#10B981", prob: 1, staleDays: 0, cards: paid },
    ];
  }, [clients, quotes, orders, challans, invoices]);

  const kpis = useMemo(() => {
    const byKey = Object.fromEntries(columns.map(c => [c.key, c]));
    const sum = (cs: Card[]) => cs.reduce((s, c) => s + c.amount, 0);
    const openValue = sum(byKey.quoted.cards) + sum(byKey.so.cards) + sum(byKey.delivered.cards);
    const weighted = ["quoted", "so", "delivered", "invoiced"].reduce((s, k) => s + sum(byKey[k].cards) * byKey[k].prob, 0);
    const overdue = byKey.invoiced.cards.filter(c => c.flag === "overdue");
    const awaiting = sum(byKey.invoiced.cards);
    return {
      openValue, openCount: byKey.quoted.cards.length + byKey.so.cards.length + byKey.delivered.cards.length,
      weighted,
      overdueValue: sum(overdue), overdueCount: overdue.length,
      awaiting, awaitingCount: byKey.invoiced.cards.length,
    };
  }, [columns]);

  if (loading) return <PageLoading message="Building your pipeline..." />;

  const kpiCard = (icon: React.ReactNode, label: string, value: string, sub: string, tone: string) => (
    <div className="card p-4 flex-1 min-w-[180px]">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: tone }}>{icon}{label}</div>
      <div className="text-[22px] font-bold text-slate-900 mt-1 nums">{value}</div>
      <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Sales Pipeline" breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Pipeline" }]} />

      {/* KPI summary — the decision layer */}
      <div className="flex flex-wrap gap-3">
        {kpiCard(<Wallet size={13} />, "Open Pipeline", money(kpis.openValue), `${kpis.openCount} deals in flight`, "#6366F1")}
        {kpiCard(<TrendingUp size={13} />, "Weighted Forecast", money(kpis.weighted), "probability-adjusted", "#8B5CF6")}
        {kpiCard(<Clock size={13} />, "Awaiting Payment", money(kpis.awaiting), `${kpis.awaitingCount} unpaid invoices`, "#F59E0B")}
        {kpiCard(<AlertTriangle size={13} />, "Overdue", money(kpis.overdueValue), `${kpis.overdueCount} past due — chase these`, "#EF4444")}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {columns.map(col => {
          const total = col.cards.reduce((s, c) => s + c.amount, 0);
          const staleCount = col.cards.filter(c => c.flag).length;
          return (
            <div key={col.key} className="shrink-0 w-[264px] flex flex-col">
              <div className="rounded-t-xl px-3 py-2.5" style={{ background: col.color + "14", borderTop: `3px solid ${col.color}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-slate-800">{col.label}</span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white rounded-full px-2 py-0.5">{col.cards.length}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  {col.key !== "lead"
                    ? <span className="text-[12.5px] font-bold" style={{ color: col.color }}>{money(total)}</span>
                    : <span className="text-[11px] text-slate-400">not yet quoted</span>}
                  {staleCount > 0 && (
                    <span className="text-[10.5px] font-semibold" style={{ color: col.key === "invoiced" ? "#EF4444" : "#D97706" }}>
                      {staleCount} {col.key === "invoiced" ? "overdue" : "stale"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-b-xl bg-slate-50/70 border border-t-0 border-slate-100 p-2 min-h-[140px]">
                {col.cards.length === 0 ? (
                  <p className="text-[12px] text-slate-300 text-center py-8">Nothing here</p>
                ) : col.cards.sort((a, b) => (b.flag ? 1 : 0) - (a.flag ? 1 : 0) || b.amount - a.amount).slice(0, 100).map(card => (
                  <Link key={card.id} href={card.href}
                    className="block bg-white rounded-lg border px-3 py-2 hover:shadow-sm transition-all"
                    style={{ borderColor: card.flag === "overdue" ? "#FCA5A5" : card.flag === "stale" ? "#FDE68A" : "#E2E8F0" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-indigo-600 truncate">{card.no}</span>
                      {card.amount > 0 && <span className="text-[12px] font-bold text-slate-800 nums shrink-0">{money(card.amount)}</span>}
                    </div>
                    <div className="text-[11.5px] text-slate-500 truncate mt-0.5">{card.client}</div>
                    <div className="flex items-center justify-between mt-1">
                      {card.sub && <span className="text-[10.5px] text-slate-400 truncate">{card.sub}</span>}
                      <span className="text-[10.5px] ml-auto shrink-0" style={{ color: card.flag === "overdue" ? "#EF4444" : card.flag === "stale" ? "#D97706" : "#94A3B8" }}>
                        {card.flag === "stale" ? `⏳ ${card.days}d` : card.flag === "overdue" ? "⚠ overdue" : `${card.days}d`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
