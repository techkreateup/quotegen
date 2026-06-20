"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaymentReceipt, Client, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import PageLoading from "@/components/PageLoading";

function ReceiptView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      id ? apiGet<PaymentReceipt>(`/api/receipts/${id}`).then(setReceipt) : Promise.resolve(),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
    ]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (receipt) {
      apiGet<Client[]>("/api/clients").then((clients) => {
        setClient(clients.find((c) => c.id === receipt.clientId));
      });
    }
  }, [receipt]);

  if (loading) return <PageLoading message="Loading receipt..." />;
  if (!receipt || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Receipt not found.</div>;

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Payment Receipt"
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Payment Receipts", href: "/payment-receipts" }, { label: receipt.receiptNo }]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={receipt.status} />
            <Link href={`/payment-receipts/new?id=${receipt.id}`} className="btn btn-outline btn-sm">
              <Edit2 size={13} /> Edit
            </Link>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={13} /> Print
            </button>
            <button onClick={() => downloadPdf("receipt-pdf", `receipt-${receipt.receiptNo}.pdf`)}
              className="btn btn-primary btn-sm">
              <Download size={13} /> Download
            </button>
            <button
              onClick={() => {
                const msg = `Payment receipt ${receipt.receiptNo} for ₹${receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}. View here: ${window.location.href}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
              className="btn btn-sm text-white"
              style={{ background: "#25D366" }}
            >
              <MessageCircle size={13} /> WhatsApp
            </button>
          </div>
        }
      />
      <div className="card">
        <DocumentPreview
          id="receipt-pdf"
          type="Payment Receipt"
          documentNo={receipt.receiptNo}
          date={receipt.receiptDate}
          title="Payment Receipt"
          status={receipt.status}
          settings={settings}
          clientName={receipt.clientName}
          clientAddress={client?.address}
          clientPhone={client?.phones?.filter(Boolean).join(", ")}
          clientEmail={client?.email}
          totalAmount={receipt.amount}
          paymentMethod={receipt.paymentMethod}
          referenceNo={receipt.referenceNo}
          invoiceNo={receipt.invoiceNo}
          notes={receipt.notes}
        />
      </div>
    </div>
  );
}

export default function PaymentReceiptViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <ReceiptView />
    </Suspense>
  );
}
