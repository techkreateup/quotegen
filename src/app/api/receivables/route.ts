import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Receivables view (Cash Command Center) — per client: what they owe us =
// Σ invoices (non-Draft, non-Cancelled) − Σ credit notes − Σ payment receipts.
// Mirrors /api/payables (Track A A5) for the buy side.

async function GET_handler(_req: NextRequest) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);

  const [clients, invoices, creditNotes, receipts] = await Promise.all([
    prisma.client.findMany({ where: { deletedAt: null }, select: { id: true, businessName: true, email: true, phones: true, gstin: true } }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["Draft", "Cancelled"] }, deletedAt: null },
      select: { id: true, invoiceNo: true, invoiceDate: true, dueDate: true, clientId: true, totalAmount: true, status: true },
    }),
    prisma.creditNote.findMany({ where: { status: { not: "Cancelled" } }, select: { clientId: true, totalAmount: true } }),
    prisma.paymentReceipt.findMany({ where: { deletedAt: null }, select: { clientId: true, amount: true, receiptDate: true } }),
  ]);

  const cnByClient = new Map<string, number>();
  for (const c of creditNotes) cnByClient.set(c.clientId, (cnByClient.get(c.clientId) ?? 0) + c.totalAmount);
  const paidByClient = new Map<string, number>();
  for (const p of receipts) paidByClient.set(p.clientId, (paidByClient.get(p.clientId) ?? 0) + p.amount);
  const invByClient = new Map<string, typeof invoices>();
  for (const i of invoices) {
    const arr = invByClient.get(i.clientId) ?? [];
    arr.push(i);
    invByClient.set(i.clientId, arr);
  }

  const rows = clients.map(v => {
    const vInv = invByClient.get(v.id) ?? [];
    const invoiced = vInv.reduce((s, b) => s + b.totalAmount, 0);
    const cn = cnByClient.get(v.id) ?? 0;
    const paid = paidByClient.get(v.id) ?? 0;
    const balance = Math.max(0, invoiced - cn - paid);

    const buckets = { current: 0, d30: 0, d60: 0, d90plus: 0 };
    let nextDueInvNo: string | null = null; let nextDue: Date | null = null;
    for (const b of vInv) {
      const due = b.dueDate ?? new Date(new Date(b.invoiceDate).getTime() + 30 * 86400_000);
      if (balance <= 0) break;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400_000);
      const share = b.totalAmount;
      if (days < 0) buckets.current += share;
      else if (days <= 30) buckets.d30 += share;
      else if (days <= 60) buckets.d60 += share;
      else buckets.d90plus += share;
      if (!nextDue || due < nextDue) { nextDue = due; nextDueInvNo = b.invoiceNo; }
    }

    return {
      clientId: v.id, clientName: v.businessName, email: v.email, phone: v.phones?.[0] ?? "", gstin: v.gstin,
      invoiced: Math.round(invoiced * 100) / 100,
      creditNotes: Math.round(cn * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      buckets,
      nextDue: nextDue ? nextDue.toISOString().split("T")[0] : null,
      nextDueInvNo,
      dueSoon: !!(nextDue && nextDue >= today && nextDue <= in7 && balance > 0),
      overdue: !!(nextDue && nextDue < today && balance > 0),
    };
  }).filter(r => r.invoiced > 0 || r.balance !== 0);

  const totals = rows.reduce((s, r) => ({
    invoiced: s.invoiced + r.invoiced, creditNotes: s.creditNotes + r.creditNotes,
    paid: s.paid + r.paid, balance: s.balance + r.balance,
    overdueBalance: s.overdueBalance + (r.overdue ? r.balance : 0),
    dueSoonBalance: s.dueSoonBalance + (r.dueSoon ? r.balance : 0),
  }), { invoiced: 0, creditNotes: 0, paid: 0, balance: 0, overdueBalance: 0, dueSoonBalance: 0 });

  return NextResponse.json({ rows: rows.sort((a, b) => b.balance - a.balance), totals });
}

export const GET = withApi(GET_handler);
