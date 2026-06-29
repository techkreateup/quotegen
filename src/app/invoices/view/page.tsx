"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Invoice, Client, CompanySettings, PaymentReceipt } from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, Plus, X, CreditCard, Send } from "lucide-react";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import ActivityTimeline from "@/components/ActivityTimeline";
import EntityNotes from "@/components/EntityNotes";
import { useToast } from "@/components/Toast";
import PageLoading from "@/components/PageLoading";
import ModalPortal from "@/components/ModalPortal";

function InvoiceView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "Bank Transfer",
    referenceNo: "",
  });

  async function loadData() {
    try {
      const [clientsData, settingsData, receiptsData] = await Promise.all([
        apiGet<Client[]>("/api/clients"),
        apiGet<CompanySettings>("/api/settings"),
        apiGet<PaymentReceipt[]>("/api/receipts").catch(() => [] as PaymentReceipt[]),
      ]);
      if (clientsData) setClients(Array.isArray(clientsData) ? clientsData : (clientsData as { data?: Client[] }).data || []);
      if (settingsData) setSettings(settingsData);
      if (receiptsData) setReceipts(receiptsData.filter((r) => r.invoiceId === id));
      if (id) {
        const inv = await apiGet<Invoice>(`/api/invoices/${id}`);
        if (inv) {
          setInvoice(inv as Invoice);
        }
      }
    } catch (err) {
      console.error("Failed to load invoice data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const toast = useToast();
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice || !paymentForm.amount || paymentForm.amount <= 0) return;
    setPaymentSubmitting(true);
    try {
      // Create receipt
      await apiPost("/api/receipts", {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: paymentForm.amount,
        receiptDate: paymentForm.receiptDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNo: paymentForm.referenceNo,
        notes: paymentForm.referenceNo ? `Payment ref: ${paymentForm.referenceNo}` : `Payment for ${invoice.invoiceNo}`,
        status: "Settled",
      });

      // Create transaction record
      await apiPost("/api/transactions", {
        date: paymentForm.receiptDate,
        type: "Revenue",
        category: "Revenue",
        description: `Payment received for ${invoice.invoiceNo} from ${invoice.clientName}`,
        amount: paymentForm.amount,
        direction: "IN",
        notes: `Method: ${paymentForm.paymentMethod}${paymentForm.referenceNo ? `. Ref: ${paymentForm.referenceNo}` : ""}`,
      }).catch(() => {}); // non-critical

      // Recalculate total paid
      const allReceipts = await apiGet<PaymentReceipt[]>("/api/receipts").catch(() => [] as PaymentReceipt[]);
      const invoiceReceipts = (allReceipts || []).filter((r: PaymentReceipt) => r.invoiceId === invoice.id);
      const newTotalPaid = invoiceReceipts.reduce((s: number, r: PaymentReceipt) => s + r.amount, 0);

      // Update invoice status — only send status fields, not the whole invoice
      const newStatus = newTotalPaid >= invoice.totalAmount ? "Paid" : "PartiallyPaid";
      const { apiPut } = await import("@/lib/api");
      await apiPut(`/api/invoices/${invoice.id}`, {
        status: newStatus,
        ...(newTotalPaid >= invoice.totalAmount ? { paymentDate: format(new Date(), "yyyy-MM-dd") } : {}),
      });

      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, receiptDate: format(new Date(), "yyyy-MM-dd"), paymentMethod: "Bank Transfer", referenceNo: "" });
      toast.success(newStatus === "Paid" ? "Invoice fully paid!" : `Payment of ₹${paymentForm.amount.toLocaleString("en-IN")} recorded`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  if (loading) return <PageLoading message="Loading invoice..." />;
  if (!invoice || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Invoice not found.</div>;

  const client = clients.find((c) => c.id === invoice.clientId);
  const totalPaid = receipts.reduce((s, r) => s + r.amount, 0);
  const remainingAmount = Math.max(0, invoice.totalAmount - totalPaid);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={invoice.title}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Invoices", href: "/invoices" }, { label: invoice.invoiceNo }]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} />
            {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
              <button onClick={() => { setPaymentForm(f => ({ ...f, amount: remainingAmount })); setShowPaymentModal(true); }}
                className="btn btn-success btn-sm">
                <CreditCard size={13} /> Record Payment
              </button>
            )}
            <Link href={`/invoices/new?id=${invoice.id}`} className="btn btn-outline btn-sm">
              <Edit2 size={13} /> Edit
            </Link>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={13} /> Print
            </button>
            <button onClick={() => downloadPdf("invoice-pdf", `invoice-${invoice.invoiceNo}.pdf`)}
              className="btn btn-primary btn-sm">
              <Download size={13} /> Download
            </button>
            <button onClick={() => setShowSend(true)} className="btn btn-sm text-white" style={{ background: "#25D366" }}>
              <Send size={13} /> Send / Share
            </button>
          </div>
        }
      />

      {showSend && (
        <SendDocumentDialog
          entityType="invoice"
          entityId={invoice.id}
          pdfElementId="invoice-pdf"
          onClose={() => setShowSend(false)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="flex items-start justify-between px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Record Payment</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Invoice {invoice.invoiceNo} · {invoice.clientName}
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="px-4 sm:px-7 py-5 space-y-4">
              {/* Payment Progress */}
              <div className="p-3 rounded-lg" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-green-700 font-medium">
                    {totalPaid > 0 ? "Payment Progress" : "Invoice Total"}
                  </span>
                  <span className="text-green-800 font-bold">
                    ₹{totalPaid.toLocaleString("en-IN")} / ₹{invoice.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {totalPaid > 0 && (
                  <div className="w-full h-2 bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(100, (totalPaid / invoice.totalAmount) * 100)}%`,
                      background: "#22C55E",
                    }} />
                  </div>
                )}
                <p className="text-[11px] text-green-600 mt-1">
                  Remaining: <strong>₹{remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Amount (INR) *</label>
                  <input type="number" required min={0.01} max={remainingAmount || undefined} step={0.01}
                    value={paymentForm.amount || ""} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    className="inp" placeholder="0.00" />
                </div>
                <div>
                  <label className="lbl">Payment Date *</label>
                  <input type="date" required value={paymentForm.receiptDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, receiptDate: e.target.value })}
                    className="inp" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Payment Method</label>
                  <select value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="inp">
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
                  <input type="text" value={paymentForm.referenceNo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                    className="inp" placeholder="Txn ID, Cheque No" />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn btn-outline" disabled={paymentSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paymentSubmitting || paymentForm.amount <= 0}>
                  {paymentSubmitting ? <><div className="spinner spinner-sm" /> Recording…</> : <><CreditCard size={14} /> Record Payment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      <div className="card">
        <DocumentPreview
          id="invoice-pdf"
          type="Invoice"
          documentNo={invoice.invoiceNo}
          date={invoice.invoiceDate}
          dueDate={invoice.dueDate}
          title={invoice.title}
          status={invoice.status}
          settings={settings}
          clientName={invoice.clientName}
          clientAddress={client?.address}
          clientPhone={client?.phones?.filter(Boolean).join(", ")}
          clientEmail={client?.email}
          clientGstin={client?.gstin}
          items={invoice.items}
          subtotal={invoice.subtotal}
          totalDiscount={invoice.totalDiscount}
          totalCgst={invoice.totalCgst}
          totalSgst={invoice.totalSgst}
          totalIgst={invoice.totalIgst}
          additionalCharges={invoice.additionalCharges}
          additionalChargesLabel={invoice.additionalChargesLabel}
          roundOff={invoice.roundOff}
          totalAmount={invoice.totalAmount}
          notes={invoice.notes}
          termsAndConditions={invoice.termsAndConditions}
          paymentDate={invoice.paymentDate}
        />
      </div>

      {/* Payment History */}
      {receipts.length > 0 && (
        <div className="card p-6 no-print">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-[12px]">{r.receiptNo}</td>
                    <td className="text-[12px]">{formatDate(r.receiptDate)}</td>
                    <td className="text-[12px] font-semibold">₹{r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="text-[12px]">{r.paymentMethod}</td>
                    <td className="text-[12px]">{r.referenceNo || "—"}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="text-right font-semibold text-[12px]">Total Paid:</td>
                  <td className="font-bold text-[13px]">₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td colSpan={3} className="text-[12px] text-slate-500">
                    {remainingAmount > 0
                      ? `Remaining: ₹${remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "Fully Paid"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="no-print"><ActivityTimeline entityType="Invoice" entityId={invoice.id} /></div>

      {/* Notes */}
      <div className="no-print"><EntityNotes entityType="Invoice" entityId={invoice.id} /></div>
    </div>
  );
}

export default function InvoiceViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading...</div>}>
      <InvoiceView />
    </Suspense>
  );
}
