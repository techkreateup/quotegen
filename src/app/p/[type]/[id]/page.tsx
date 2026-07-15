"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import DocumentPreview from "@/components/DocumentPreview";
import { downloadPdf } from "@/lib/pdf";
import { Download, Printer } from "lucide-react";

const TYPE_META: Record<string, { label: string; noKey: string; dateKey: string; pdfId: string }> = {
  invoice:         { label: "Invoice",          noKey: "invoiceNo",         dateKey: "invoiceDate",   pdfId: "invoice-pdf" },
  quotation:       { label: "Quotation",        noKey: "quotationNo",       dateKey: "quotationDate", pdfId: "quotation-pdf" },
  receipt:         { label: "Payment Receipt",  noKey: "receiptNo",         dateKey: "receiptDate",   pdfId: "receipt-pdf" },
  salesOrder:      { label: "Sales Order",      noKey: "salesOrderNo",      dateKey: "orderDate",     pdfId: "so-pdf" },
  deliveryChallan: { label: "Delivery Challan", noKey: "challanNo",         dateKey: "challanDate",   pdfId: "dc-pdf" },
  purchaseOrder:   { label: "Purchase Order",   noKey: "purchaseOrderNo",   dateKey: "orderDate",     pdfId: "po-pdf" },
  debitNote:       { label: "Debit Note",       noKey: "debitNoteNo",       dateKey: "debitNoteDate", pdfId: "dn-pdf" },
};

export default function PublicSharePage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params);
  const sp = useSearchParams();
  const token = sp.get("t") || "";
  const meta = TYPE_META[type];
  const [data, setData] = useState<{ doc: Record<string, unknown>; settings: Record<string, unknown>; client: Record<string, unknown> | null } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/doc/${type}/${id}?t=${encodeURIComponent(token)}`)
      .then(async r => r.ok ? r.json() : Promise.reject(await r.text()))
      .then(setData)
      .catch(e => setError(String(e)));
  }, [type, id, token]);

  useEffect(() => {
    if (data && meta) {
      const no = String((data.doc as Record<string, unknown>)[meta.noKey] ?? "");
      document.title = `${meta.label} ${no}`;
    }
  }, [data, meta]);

  if (!meta) return <div className="min-h-screen flex items-center justify-center text-slate-500">Unknown document type.</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-slate-500 p-6 text-center">Link expired or invalid. Please request a fresh link from the sender.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;

  const { doc, settings, client } = data;
  const items = (doc.items as unknown[]) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[880px] mx-auto p-3 sm:p-6">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h1 className="text-[15px] sm:text-[17px] font-semibold text-slate-700">{meta.label} · {String(doc[meta.noKey] ?? "")}</h1>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13}/> Print</button>
            <button onClick={() => downloadPdf(meta.pdfId, `${meta.label}-${doc[meta.noKey]}.pdf`)} className="btn btn-primary btn-sm"><Download size={13}/> Download</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <DocumentPreview
            id={meta.pdfId}
            type={meta.label as never}
            documentNo={String(doc[meta.noKey] ?? "")}
            date={String(doc[meta.dateKey] ?? "")}
            dueDate={doc.dueDate ? String(doc.dueDate) : undefined}
            title={meta.label}
            status={(doc.status as string) ?? ""}
            settings={settings as never}
            clientName={String((client as Record<string, unknown> | null)?.businessName ?? doc.clientName ?? "")}
            clientAddress={String((client as Record<string, unknown> | null)?.address ?? "")}
            clientEmail={String((client as Record<string, unknown> | null)?.email ?? "")}
            clientGstin={String((client as Record<string, unknown> | null)?.gstin ?? "")}
            items={items as never}
            subtotal={Number(doc.subtotal ?? 0)}
            totalCgst={Number(doc.totalCgst ?? 0)}
            totalSgst={Number(doc.totalSgst ?? 0)}
            totalIgst={Number(doc.totalIgst ?? 0)}
            totalAmount={Number(doc.totalAmount ?? doc.amount ?? 0)}
            notes={doc.notes ? String(doc.notes) : undefined}
            invoiceNo={doc.invoiceNo ? String(doc.invoiceNo) : undefined}
            paymentMethod={doc.paymentMethod ? String(doc.paymentMethod) : undefined}
            referenceNo={doc.referenceNo ? String(doc.referenceNo) : undefined}
          />
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-4">Powered by <a href="https://quotegen.kreateup.in" className="text-indigo-600">QuoteGen</a></p>
      </div>
    </div>
  );
}
