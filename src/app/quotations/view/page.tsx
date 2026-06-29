"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Quotation, Client, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, Send } from "lucide-react";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import Link from "next/link";
import { Suspense } from "react";
import PageLoading from "@/components/PageLoading";

function QuotationView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Client[]>("/api/clients").then(setClients),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<Quotation>(`/api/quotations/${id}`).then((q) => { if (q) setQuotation(q); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading message="Loading quotation..." />;
  if (!quotation || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Quotation not found.</div>;

  const client = clients.find((c) => c.id === quotation.clientId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={quotation.title}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Quotations", href: "/quotations" }, { label: quotation.quotationNo }]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={quotation.status} />
            <Link href={`/quotations/new?id=${quotation.id}`} className="btn btn-outline btn-sm">
              <Edit2 size={13} /> Edit
            </Link>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={13} /> Print
            </button>
            <button onClick={() => downloadPdf("quotation-pdf", `quotation-${quotation.quotationNo}.pdf`)}
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
          entityType="quotation"
          entityId={quotation.id}
          pdfElementId="quotation-pdf"
          onClose={() => setShowSend(false)}
        />
      )}

      <div className="card">
        <DocumentPreview
          id="quotation-pdf"
          type="Quotation"
          documentNo={quotation.quotationNo}
          date={quotation.quotationDate}
          dueDate={quotation.dueDate}
          title={quotation.title}
          status={quotation.status}
          settings={settings}
          clientName={quotation.clientName}
          clientAddress={client?.address}
          clientPhone={client?.phones?.filter(Boolean).join(", ")}
          clientEmail={client?.email}
          clientGstin={client?.gstin}
          items={quotation.items}
          subtotal={quotation.subtotal}
          totalDiscount={quotation.totalDiscount}
          totalCgst={quotation.totalCgst}
          totalSgst={quotation.totalSgst}
          totalIgst={quotation.totalIgst}
          additionalCharges={quotation.additionalCharges}
          additionalChargesLabel={quotation.additionalChargesLabel}
          roundOff={quotation.roundOff}
          totalAmount={quotation.totalAmount}
          notes={quotation.notes}
          termsAndConditions={quotation.termsAndConditions}
        />
      </div>
    </div>
  );
}

export default function QuotationViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <QuotationView />
    </Suspense>
  );
}
