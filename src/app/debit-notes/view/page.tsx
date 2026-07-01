"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DebitNote, Vendor, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer } from "lucide-react";
import PageLoading from "@/components/PageLoading";

function DebitNoteView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [dn, setDn] = useState<DebitNote | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data)),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<DebitNote>(`/api/debit-notes/${id}`).then((d) => { if (d) setDn(d); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading message="Loading debit note..." />;
  if (!dn || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Debit note not found.</div>;

  const vendor = vendors.find((v) => v.id === dn.vendorId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Debit Note"
        breadcrumbs={[{ label: "Finance" }, { label: "Debit Notes", href: "/debit-notes" }, { label: dn.debitNoteNo }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={dn.status} />
            <a href={`/debit-notes/new?id=${dn.id}`} className="btn btn-outline btn-sm"><Edit2 size={13} /> Edit</a>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            <button onClick={() => downloadPdf("dn-pdf", `debit-note-${dn.debitNoteNo}.pdf`)} className="btn btn-primary btn-sm"><Download size={13} /> Download</button>
          </div>
        }
      />

      <DocumentLineage related={dn.related} current={{ label: "Debit Note", no: dn.debitNoteNo }}
        hint="This debit note reduces the amount payable to the vendor on its source bill." />

      <div className="card p-4 text-[13px] flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="font-semibold text-slate-700">Reason:</span> <span className="text-slate-600">{dn.reason}</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-red-600">Debit Amount: −₹{dn.totalAmount.toLocaleString("en-IN")}</span>
      </div>

      <div className="card">
        <DocumentPreview
          id="dn-pdf"
          type="Debit Note"
          documentNo={dn.debitNoteNo}
          date={dn.debitNoteDate}
          title="Debit Note"
          status={dn.status}
          settings={settings}
          clientName={dn.vendorName || vendor?.name || ""}
          clientAddress={vendor?.address}
          clientPhone={vendor?.phone}
          clientEmail={vendor?.email}
          clientGstin={vendor?.gstin}
          items={dn.items}
          subtotal={dn.subtotal}
          totalCgst={dn.totalCgst}
          totalSgst={dn.totalSgst}
          totalIgst={dn.totalIgst}
          totalAmount={dn.totalAmount}
          notes={dn.notes}
        />
      </div>
    </div>
  );
}

export default function DebitNoteViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <DebitNoteView />
    </Suspense>
  );
}
