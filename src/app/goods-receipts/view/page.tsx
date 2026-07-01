"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GoodsReceiptNote, Vendor, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer } from "lucide-react";
import PageLoading from "@/components/PageLoading";

function GoodsReceiptView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data)),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<GoodsReceiptNote>(`/api/goods-receipts/${id}`).then((g) => { if (g) setGrn(g); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading message="Loading goods receipt..." />;
  if (!grn || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Goods receipt not found.</div>;

  const vendor = vendors.find((v) => v.id === grn.vendorId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={grn.title}
        breadcrumbs={[{ label: "Finance" }, { label: "Goods Receipts", href: "/goods-receipts" }, { label: grn.grnNo }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={grn.status} />
            <a href={`/goods-receipts/new?id=${grn.id}`} className="btn btn-outline btn-sm"><Edit2 size={13} /> Edit</a>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            <button onClick={() => downloadPdf("grn-pdf", `goods-receipt-${grn.grnNo}.pdf`)} className="btn btn-primary btn-sm"><Download size={13} /> Download</button>
          </div>
        }
      />

      <DocumentLineage related={grn.related} current={{ label: "Goods Receipt", no: grn.grnNo }}
        hint="Match against the vendor's bill, then raise a Debit Note for any short supply." />

      {grn.vehicleNo && (
        <div className="card p-4 text-[13px]"><span className="font-semibold text-slate-700">Vehicle:</span> <span className="text-slate-600">{grn.vehicleNo}</span></div>
      )}

      <div className="card">
        <DocumentPreview
          id="grn-pdf"
          type="Goods Receipt Note"
          documentNo={grn.grnNo}
          date={grn.receiptDate}
          title={grn.title}
          status={grn.status}
          settings={settings}
          clientName={grn.vendorName || vendor?.name || ""}
          clientAddress={vendor?.address}
          clientPhone={vendor?.phone}
          clientEmail={vendor?.email}
          clientGstin={vendor?.gstin}
          items={grn.items}
          subtotal={grn.subtotal}
          totalCgst={grn.totalCgst}
          totalSgst={grn.totalSgst}
          totalIgst={grn.totalIgst}
          totalAmount={grn.totalAmount}
          notes={grn.notes}
          termsAndConditions={grn.termsAndConditions}
        />
      </div>
    </div>
  );
}

export default function GoodsReceiptViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <GoodsReceiptView />
    </Suspense>
  );
}
