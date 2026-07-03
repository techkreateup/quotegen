import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Payables view (Track A A5) — per vendor: what we owe = Σ bills − Σ debit notes
// − Σ payments already recorded. Adds ageing buckets and a "days-until-due" flag
// so the user can see which bills to chase or pay next.

async function GET_handler(_req: NextRequest) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);

  const [vendors, bills, debitNotes, payments] = await Promise.all([
    prisma.vendor.findMany({ where: { deletedAt: null }, select: { id: true, name: true, email: true, phone: true, gstin: true, tdsSection: true, tdsRate: true } }),
    prisma.purchaseBill.findMany({ where: { status: { not: "Cancelled" }, deletedAt: null }, select: { id: true, billNo: true, billDate: true, dueDate: true, vendorId: true, totalAmount: true, status: true } }),
    prisma.debitNote.findMany({ where: { status: { not: "Cancelled" } }, select: { vendorId: true, totalAmount: true } }),
    prisma.vendorPayment.findMany({ select: { vendorId: true, amount: true, paidDate: true } }),
  ]);

  const dnByVendor = new Map<string, number>();
  for (const d of debitNotes) dnByVendor.set(d.vendorId, (dnByVendor.get(d.vendorId) ?? 0) + d.totalAmount);
  const paidByVendor = new Map<string, number>();
  for (const p of payments) paidByVendor.set(p.vendorId, (paidByVendor.get(p.vendorId) ?? 0) + p.amount);
  const billsByVendor = new Map<string, typeof bills>();
  for (const b of bills) {
    const arr = billsByVendor.get(b.vendorId) ?? [];
    arr.push(b);
    billsByVendor.set(b.vendorId, arr);
  }

  const rows = vendors.map(v => {
    const vBills = billsByVendor.get(v.id) ?? [];
    const billed = vBills.reduce((s, b) => s + b.totalAmount, 0);
    const dn = dnByVendor.get(v.id) ?? 0;
    const paid = paidByVendor.get(v.id) ?? 0;
    const net = billed - dn - paid;
    const balance = Math.max(0, net);
    // When payments already made exceed the outstanding invoiced-minus-credited
    // amount, the excess is an advance sitting with the vendor. Positive number
    // means the vendor holds THIS company's money against future bills.
    const advance = Math.max(0, -net);

    // Ageing based on bill dueDate (fallback billDate + 30). Distributes total
    // OPEN balance across buckets proportionally to bill exposure — simple v1.
    const buckets = { current: 0, d30: 0, d60: 0, d90plus: 0 };
    let nextDueBillNo: string | null = null; let nextDue: Date | null = null;
    for (const b of vBills) {
      const due = b.dueDate ?? new Date(new Date(b.billDate).getTime() + 30 * 86400_000);
      if (balance <= 0) break;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400_000);
      const share = b.totalAmount; // approximate — pre-allocation of DN/payments to specific bills is out of v1 scope
      if (days < 0) buckets.current += share;
      else if (days <= 30) buckets.d30 += share;
      else if (days <= 60) buckets.d60 += share;
      else buckets.d90plus += share;
      if (!nextDue || due < nextDue) { nextDue = due; nextDueBillNo = b.billNo; }
    }

    return {
      vendorId: v.id, vendorName: v.name, email: v.email, phone: v.phone, gstin: v.gstin,
      tdsSection: v.tdsSection || "", tdsRate: v.tdsRate || 0,
      billed: Math.round(billed * 100) / 100,
      debitNotes: Math.round(dn * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      advance: Math.round(advance * 100) / 100,
      buckets,
      nextDue: nextDue ? nextDue.toISOString().split("T")[0] : null,
      nextDueBillNo,
      dueSoon: !!(nextDue && nextDue >= today && nextDue <= in7 && balance > 0),
      overdue: !!(nextDue && nextDue < today && balance > 0),
    };
  }).filter(r => r.billed > 0 || r.balance !== 0 || r.advance !== 0);

  const totals = rows.reduce((s, r) => ({
    billed: s.billed + r.billed, debitNotes: s.debitNotes + r.debitNotes,
    paid: s.paid + r.paid, balance: s.balance + r.balance,
    advance: s.advance + r.advance,
    overdueBalance: s.overdueBalance + (r.overdue ? r.balance : 0),
    dueSoonBalance: s.dueSoonBalance + (r.dueSoon ? r.balance : 0),
  }), { billed: 0, debitNotes: 0, paid: 0, balance: 0, advance: 0, overdueBalance: 0, dueSoonBalance: 0 });

  return NextResponse.json({ rows: rows.sort((a, b) => b.balance - a.balance), totals });
}

export const GET = withApi(GET_handler);
