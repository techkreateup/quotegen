"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeliveryChallan, Client, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, ArrowRight } from "lucide-react";
import { useToast } from "@/components/Toast";
import PageLoading from "@/components/PageLoading";

function DeliveryChallanViewInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const toast = useToast();
  const [dc, setDc] = useState<DeliveryChallan | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Client[]>("/api/clients").then(setClients),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<DeliveryChallan>(`/api/delivery-challans/${id}`).then((c) => { if (c) setDc(c); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function convertToInvoice() {
    if (!dc) return;
    setBusy(true);
    try {
      const r = await fetch("/api/invoices/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromType: "deliveryChallan", fromId: dc.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Invoice ${d.number} created`);
      router.push(`/invoices/view?id=${d.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <PageLoading message="Loading delivery challan..." />;
  if (!dc || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Delivery challan not found.</div>;

  const client = clients.find((c) => c.id === dc.clientId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={dc.title}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Delivery Challans", href: "/delivery-challans" }, { label: dc.challanNo }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={dc.status} />
            <a href={`/delivery-challans/new?id=${dc.id}`} className="btn btn-outline btn-sm"><Edit2 size={13} /> Edit</a>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            <button onClick={() => downloadPdf("challan-pdf", `delivery-challan-${dc.challanNo}.pdf`)} className="btn btn-outline btn-sm"><Download size={13} /> Download</button>
            <button onClick={convertToInvoice} disabled={busy} className="btn btn-primary btn-sm"><ArrowRight size={13} /> To Invoice</button>
          </div>
        }
      />

      <DocumentLineage related={dc.related} current={{ label: "Delivery Challan", no: dc.challanNo }}
        hint="Convert to an Invoice to bill the delivered goods." />

      <div className="card p-4 text-[13px] flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="font-semibold text-slate-700">{dc.challanType === "JobWork" ? "Job Work" : dc.challanType} Challan</span>
        {dc.vehicleNo && <span className="text-slate-500">Vehicle: <b className="text-slate-700">{dc.vehicleNo}</b></span>}
        {(dc as unknown as { ewbNo?: string }).ewbNo && <span className="text-slate-500">EWB: <b className="text-slate-700">{(dc as unknown as { ewbNo?: string }).ewbNo}</b></span>}
        {dc.totalAmount > 50000 && !(dc as unknown as { ewbNo?: string }).ewbNo && (
          <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 text-[11.5px] font-semibold">⚠ E-way bill required (Rule 138)</span>
        )}
      </div>

      <div className="card">
        <DocumentPreview
          id="challan-pdf"
          currency={client?.currency}
          type="Delivery Challan"
          documentNo={dc.challanNo}
          date={dc.challanDate}
          title={dc.title}
          status={dc.status}
          settings={settings}
          clientName={dc.clientName}
          clientAddress={client?.address}
          clientPhone={client?.phones?.filter(Boolean).join(", ")}
          clientEmail={client?.email}
          clientGstin={client?.gstin}
          items={dc.items}
          subtotal={dc.subtotal}
          totalDiscount={dc.totalDiscount}
          totalCgst={dc.totalCgst}
          totalSgst={dc.totalSgst}
          totalIgst={dc.totalIgst}
          additionalCharges={dc.additionalCharges}
          additionalChargesLabel={dc.additionalChargesLabel}
          roundOff={dc.roundOff}
          totalAmount={dc.totalAmount}
          notes={dc.notes}
          termsAndConditions={dc.termsAndConditions}
        />
      </div>
    </div>
  );
}

export default function DeliveryChallanViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <DeliveryChallanViewInner />
    </Suspense>
  );
}
