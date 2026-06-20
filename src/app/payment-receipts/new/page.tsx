"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Invoice, PaymentReceipt } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { format } from "date-fns";
import { Suspense } from "react";

function ReceiptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const preselectedInvoiceId = searchParams.get("invoiceId");
  const toast = useToast();

  const [invoices, setInvoices]           = useState<Invoice[]>([]);
  const [receipts, setReceipts]           = useState<PaymentReceipt[]>([]);
  const [receiptDate, setReceiptDate]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceId, setInvoiceId]         = useState("");
  const [amount, setAmount]               = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [referenceNo, setReferenceNo]     = useState("");
  const [notes, setNotes]                 = useState("");
  const [submitting, setSubmitting]       = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Invoice[] | { data: Invoice[] }>("/api/invoices"),
      apiGet<PaymentReceipt[]>("/api/receipts").catch(() => [] as PaymentReceipt[]),
    ]).then(([inv, rec]) => {
      const invoiceList = Array.isArray(inv) ? inv : inv?.data || [];
      setInvoices(invoiceList);
      if (rec) setReceipts(Array.isArray(rec) ? rec : []);

      // Pre-select invoice if provided in URL
      if (preselectedInvoiceId && !editId) {
        const target = invoiceList.find(i => i.id === preselectedInvoiceId);
        if (target) {
          setInvoiceId(preselectedInvoiceId);
          // Calculate remaining amount
          const paidSoFar = (Array.isArray(rec) ? rec : []).filter(r => r.invoiceId === preselectedInvoiceId).reduce((s, r) => s + r.amount, 0);
          setAmount(Math.max(0, target.totalAmount - paidSoFar));
        }
      }
    });

    if (editId) {
      apiGet<PaymentReceipt>(`/api/receipts/${editId}`).then((r) => {
        if (r) {
          setReceiptDate(r.receiptDate); setInvoiceId(r.invoiceId); setAmount(r.amount);
          setPaymentMethod(r.paymentMethod); setReferenceNo(r.referenceNo); setNotes(r.notes);
        }
      });
    }
  }, [editId, preselectedInvoiceId]);

  // Calculate remaining for selected invoice
  const selectedInvoice = invoices.find(i => i.id === invoiceId);
  const paidForSelected = receipts.filter(r => r.invoiceId === invoiceId).reduce((s, r) => s + r.amount, 0);
  const remainingForSelected = selectedInvoice ? Math.max(0, selectedInvoice.totalAmount - paidForSelected) : 0;

  function handleInvoiceSelect(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      const paid = receipts.filter(r => r.invoiceId === id).reduce((s, r) => s + r.amount, 0);
      setAmount(Math.max(0, inv.totalAmount - paid));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId || amount <= 0) return;
    setSubmitting(true);

    const inv = invoices.find((i) => i.id === invoiceId);
    const data = {
      receiptDate, invoiceId,
      clientId: inv?.clientId || "",
      amount, paymentMethod, referenceNo, notes, status: "Settled" as const,
    };

    try {
      if (editId) {
        await apiPut(`/api/receipts/${editId}`, data);
        toast.success("Receipt updated");
      } else {
        await apiPost("/api/receipts", data);

        // Create a transaction record for the payment
        await apiPost("/api/transactions", {
          date: receiptDate,
          type: "Revenue",
          category: "Revenue",
          description: `Payment received for ${inv?.invoiceNo || ""} from ${inv?.clientName || ""}`,
          amount,
          direction: "IN",
          notes: `Receipt for ${inv?.invoiceNo}. Method: ${paymentMethod}${referenceNo ? `. Ref: ${referenceNo}` : ""}`,
        }).catch(() => {}); // non-critical

        // Update invoice status based on total payments
        if (inv) {
          const totalPaidNow = paidForSelected + amount;
          const newStatus = totalPaidNow >= inv.totalAmount ? "Paid" : "PartiallyPaid";
          await apiPut(`/api/invoices/${invoiceId}`, {
            status: newStatus,
            paymentDate: totalPaidNow >= inv.totalAmount ? receiptDate : undefined,
          }).catch(() => {});
        }

        toast.success("Payment recorded successfully");
      }
      router.push("/payment-receipts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  // Show invoices that are not fully paid and not cancelled
  const availableInvoices = invoices.filter((inv) => {
    if (inv.status === "Cancelled") return false;
    if (inv.status === "Paid") return inv.id === invoiceId; // allow editing existing
    return true; // Unpaid, PartiallyPaid, Overdue, Draft
  });

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Payment Receipt" : "Record Payment"}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Payment Receipts", href: "/payment-receipts" }, { label: editId ? "Edit" : "New" }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        <div className="card p-6 space-y-4">
          <div>
            <label className="lbl">Invoice *</label>
            <select required value={invoiceId} onChange={(e) => handleInvoiceSelect(e.target.value)} className="inp">
              <option value="">Select Invoice</option>
              {availableInvoices.map((inv) => {
                const paid = receipts.filter(r => r.invoiceId === inv.id).reduce((s, r) => s + r.amount, 0);
                const remaining = Math.max(0, inv.totalAmount - paid);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo} — {inv.clientName} (Total: ₹{inv.totalAmount.toLocaleString("en-IN")}
                    {paid > 0 ? ` · Paid: ₹${paid.toLocaleString("en-IN")} · Due: ₹${remaining.toLocaleString("en-IN")}` : ""})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Show payment progress for selected invoice */}
          {selectedInvoice && paidForSelected > 0 && (
            <div className="p-3 rounded-lg" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="text-blue-700 font-medium">Payment Progress</span>
                <span className="text-blue-800 font-bold">
                  ₹{paidForSelected.toLocaleString("en-IN")} / ₹{selectedInvoice.totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, (paidForSelected / selectedInvoice.totalAmount) * 100)}%`,
                  background: paidForSelected >= selectedInvoice.totalAmount ? "#22C55E" : "#3B82F6",
                }} />
              </div>
              <p className="text-[11px] text-blue-600 mt-1.5">
                Remaining: ₹{remainingForSelected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="lbl">Receipt Date *</label>
              <input type="date" required value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Amount * {remainingForSelected > 0 && <span className="text-slate-400 font-normal">(max ₹{remainingForSelected.toLocaleString("en-IN")})</span>}</label>
              <input type="number" required min={0.01} step={0.01} value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))} className="inp" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="lbl">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="inp">
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Cash</option>
                <option>Cheque</option>
                <option>Credit Card</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="lbl">Reference No</label>
              <input type="text" value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="inp" placeholder="Transaction ID, UPI Ref, Cheque No" />
            </div>
          </div>

          <div>
            <label className="lbl">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} className="inp" placeholder="Optional notes about this payment" />
          </div>
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" className="btn btn-success btn-lg" disabled={submitting}>
            {submitting ? <><div className="spinner spinner-sm" /> Saving…</> : editId ? "Update Receipt" : "Save Payment"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-outline btn-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PaymentReceiptNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <ReceiptForm />
    </Suspense>
  );
}
