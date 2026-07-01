"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Quotation, Client, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, Send, ClipboardList, ArrowRight } from "lucide-react";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { Suspense } from "react";
import PageLoading from "@/components/PageLoading";

function QuotationView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const id = searchParams.get("id");
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = () => id && apiGet<Quotation>(`/api/quotations/${id}`).then((q) => { if (q) setQuotation(q); });
  useEffect(() => {
    Promise.all([
      apiGet<Client[]>("/api/clients").then(setClients),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<Quotation>(`/api/quotations/${id}`).then((q) => { if (q) setQuotation(q); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function convert(target: "salesOrder" | "invoice") {
    if (!quotation) return;
    setBusy(true);
    try {
      const url = target === "salesOrder" ? "/api/sales-orders/convert" : "/api/invoices/convert";
      const body = target === "salesOrder" ? { quotationId: quotation.id } : { fromType: "quotation", fromId: quotation.id };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (target === "salesOrder") { toast.success(`Sales Order ${d.number} created`); router.push(`/sales-orders/view?id=${d.id}`); }
      else { toast.success(`Invoice ${d.number} created`); router.push(`/invoices/view?id=${d.id}`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); reload(); }
    finally { setBusy(false); }
  }

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
            <button onClick={() => convert("salesOrder")} disabled={busy} className="btn btn-outline btn-sm">
              <ClipboardList size={13} /> To Sales Order
            </button>
            <button onClick={() => convert("invoice")} disabled={busy} className="btn btn-primary btn-sm">
              <ArrowRight size={13} /> To Invoice
            </button>
          </div>
        }
      />

      <DocumentLineage related={quotation.related} current={{ label: quotation.docType === "Proforma" ? "Proforma" : "Quotation", no: quotation.quotationNo }}
        hint="When the client accepts, convert to a Sales Order (on their PO) or straight to an Invoice." />

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
          type={quotation.docType === "Proforma" ? "Proforma Invoice" : "Quotation"}
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
