"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SalesOrder, Client, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, ArrowRight, Truck } from "lucide-react";
import { useToast } from "@/components/Toast";
import PageLoading from "@/components/PageLoading";

function SalesOrderView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const toast = useToast();
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Client[]>("/api/clients").then(setClients),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<SalesOrder>(`/api/sales-orders/${id}`).then((o) => { if (o) setSo(o); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function convert(target: "invoice" | "challan") {
    if (!so) return;
    setBusy(true);
    try {
      const url = target === "invoice" ? "/api/invoices/convert" : "/api/delivery-challans/convert";
      const body = target === "invoice" ? { fromType: "salesOrder", fromId: so.id } : { salesOrderId: so.id };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (target === "invoice") { toast.success(`Invoice ${d.number} created`); router.push(`/invoices/view?id=${d.id}`); }
      else { toast.success(`Delivery Challan ${d.number} created`); router.push(`/delivery-challans/view?id=${d.id}`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <PageLoading message="Loading sales order..." />;
  if (!so || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Sales order not found.</div>;

  const client = clients.find((c) => c.id === so.clientId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={so.title}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Sales Orders", href: "/sales-orders" }, { label: so.salesOrderNo }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={so.status} />
            <a href={`/sales-orders/new?id=${so.id}`} className="btn btn-outline btn-sm"><Edit2 size={13} /> Edit</a>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            <button onClick={() => downloadPdf("sales-order-pdf", `sales-order-${so.salesOrderNo}.pdf`)} className="btn btn-outline btn-sm"><Download size={13} /> Download</button>
            <button onClick={() => convert("challan")} disabled={busy} className="btn btn-outline btn-sm"><Truck size={13} /> To Challan</button>
            <button onClick={() => convert("invoice")} disabled={busy} className="btn btn-primary btn-sm"><ArrowRight size={13} /> To Invoice</button>
          </div>
        }
      />

      <DocumentLineage related={so.related} current={{ label: "Sales Order", no: so.salesOrderNo }}
        hint="Create a Delivery Challan when goods ship, or convert to an Invoice to bill this order." />

      {(so.clientPoNumber || so.clientPoFileUrl) && (
        <div className="card p-4 text-[13px] flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-semibold text-slate-700">Client PO</span>
          {so.clientPoNumber && <span className="text-slate-500">No: <b className="text-slate-700">{so.clientPoNumber}</b></span>}
          {so.clientPoDate && <span className="text-slate-500">Dated: {so.clientPoDate}</span>}
          {so.clientPoFileUrl && <a href={so.clientPoFileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">View PO document →</a>}
        </div>
      )}

      <div className="card">
        <DocumentPreview
          id="sales-order-pdf"
          type="Sales Order"
          documentNo={so.salesOrderNo}
          date={so.orderDate}
          dueDate={so.dueDate}
          title={so.title}
          status={so.status}
          settings={settings}
          clientName={so.clientName}
          clientAddress={client?.address}
          clientPhone={client?.phones?.filter(Boolean).join(", ")}
          clientEmail={client?.email}
          clientGstin={client?.gstin}
          items={so.items}
          subtotal={so.subtotal}
          totalDiscount={so.totalDiscount}
          totalCgst={so.totalCgst}
          totalSgst={so.totalSgst}
          totalIgst={so.totalIgst}
          additionalCharges={so.additionalCharges}
          additionalChargesLabel={so.additionalChargesLabel}
          roundOff={so.roundOff}
          totalAmount={so.totalAmount}
          notes={so.notes}
          termsAndConditions={so.termsAndConditions}
        />
      </div>
    </div>
  );
}

export default function SalesOrderViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <SalesOrderView />
    </Suspense>
  );
}
