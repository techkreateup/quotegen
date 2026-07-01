"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PurchaseOrder, Vendor, CompanySettings } from "@/lib/types";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentLineage from "@/components/DocumentLineage";
import { downloadPdf } from "@/lib/pdf";
import { Edit2, Download, Printer, ArrowRight, PackageCheck, AlertTriangle, CheckCircle2, FileMinus } from "lucide-react";
import { useToast } from "@/components/Toast";
import PageLoading from "@/components/PageLoading";

function PurchaseOrderView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const toast = useToast();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data)),
      apiGet<CompanySettings>("/api/settings").then(setSettings),
      id ? apiGet<PurchaseOrder>(`/api/purchase-orders/${id}`).then((o) => { if (o) setPo(o); }) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [id]);

  async function convertToBill() {
    if (!po) return;
    setBusy(true);
    try {
      const r = await fetch("/api/purchase-bills/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseOrderId: po.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Vendor Bill ${d.billNo} created — update it with the vendor's actual bill number`);
      router.push("/purchase-bills");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
    finally { setBusy(false); }
  }

  async function receiveGrn() {
    if (!po) return;
    setBusy(true);
    try {
      const r = await fetch("/api/goods-receipts/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseOrderId: po.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Goods Receipt ${d.grnNo} created`);
      router.push(`/goods-receipts/view?id=${d.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Receive failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <PageLoading message="Loading purchase order..." />;
  if (!po || !settings) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Purchase order not found.</div>;

  const vendor = vendors.find((v) => v.id === po.vendorId);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={po.title}
        breadcrumbs={[{ label: "Finance" }, { label: "Purchase Orders", href: "/purchase-orders" }, { label: po.purchaseOrderNo }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={po.status} />
            <a href={`/purchase-orders/new?id=${po.id}`} className="btn btn-outline btn-sm"><Edit2 size={13} /> Edit</a>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            <button onClick={() => downloadPdf("po-pdf", `purchase-order-${po.purchaseOrderNo}.pdf`)} className="btn btn-outline btn-sm"><Download size={13} /> Download</button>
            <button onClick={receiveGrn} disabled={busy} className="btn btn-outline btn-sm"><PackageCheck size={13} /> Receive (GRN)</button>
            <button onClick={convertToBill} disabled={busy} className="btn btn-primary btn-sm"><ArrowRight size={13} /> To Vendor Bill</button>
          </div>
        }
      />

      <DocumentLineage related={po.related} current={{ label: "Purchase Order", no: po.purchaseOrderNo }}
        hint="When the vendor's invoice arrives, convert to a Vendor Bill." />

      <MatchReportPanel purchaseOrderId={po.id} vendorId={po.vendorId} />

      <div className="card">
        <DocumentPreview
          id="po-pdf"
          type="Purchase Order"
          documentNo={po.purchaseOrderNo}
          date={po.orderDate}
          dueDate={po.expectedDate}
          title={po.title}
          status={po.status}
          settings={settings}
          clientName={po.vendorName || vendor?.name || ""}
          clientAddress={vendor?.address}
          clientPhone={vendor?.phone}
          clientEmail={vendor?.email}
          clientGstin={vendor?.gstin}
          items={po.items}
          subtotal={po.subtotal}
          totalDiscount={po.totalDiscount}
          totalCgst={po.totalCgst}
          totalSgst={po.totalSgst}
          totalIgst={po.totalIgst}
          additionalCharges={po.additionalCharges}
          additionalChargesLabel={po.additionalChargesLabel}
          roundOff={po.roundOff}
          totalAmount={po.totalAmount}
          notes={po.notes}
          termsAndConditions={po.termsAndConditions}
        />
      </div>
    </div>
  );
}

// 3-way match panel: PO × GRN × Bill with variance flags.
interface MatchLine { itemName: string; orderedQty: number; receivedQty: number; billedQty: number; poRate: number; billRate: number; orderedValue: number; receivedValue: number; billedValue: number; qtyVariancePct: number; rateVariancePct: number; flag: null | "short_supply" | "over_bill" | "rate_variance"; }
interface MatchReport { tolerancePct: number; totals: { ordered: number; received: number; billed: number; debitNoted: number; payable: number; }; lines: MatchLine[]; flaggedCount: number; }

function MatchReportPanel({ purchaseOrderId, vendorId }: { purchaseOrderId: string; vendorId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<MatchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/purchase-orders/${purchaseOrderId}/reconcile`).then(r => r.ok ? r.json() : null).then(setReport).finally(() => setLoading(false));
  }, [purchaseOrderId]);

  if (loading) return <div className="card p-4 text-[12px] text-slate-400">Loading match report…</div>;
  if (!report) return null;
  if (report.totals.billed === 0 && report.totals.received === 0) {
    return <div className="card p-4 text-[12.5px] text-slate-500 flex items-center gap-2"><CheckCircle2 size={14} className="text-slate-300" /> 3-way match will appear once goods are received and the vendor bill is recorded.</div>;
  }

  const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const FLAG_TEXT: Record<string, string> = { over_bill: "Over-billed", short_supply: "Short supply", rate_variance: "Rate variance" };
  const FLAG_COLOR: Record<string, string> = { over_bill: "#DC2626", short_supply: "#D97706", rate_variance: "#F59E0B" };

  async function raiseDebitNote() {
    // Find the newest bill for this PO to pin the DN to.
    setBusy(true);
    try {
      const bills = await fetch("/api/purchase-bills").then(r => r.json());
      const list = Array.isArray(bills) ? bills : bills?.data || [];
      const linked = list.find((b: { purchaseOrderId?: string }) => b.purchaseOrderId === purchaseOrderId) || list.find((b: { vendorId?: string }) => b.vendorId === vendorId);
      if (!linked) { toast.error("Record the vendor bill first, then raise a debit note."); return; }
      const r = await fetch("/api/debit-notes/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseBillId: linked.id, reason: report && report.lines.some(l => l.flag === "over_bill") ? "Overbilling" : report && report.lines.some(l => l.flag === "rate_variance") ? "Rate Variance" : "Short Supply" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Debit Note ${d.debitNoteNo} created — trim quantities to match the variance`);
      router.push(`/debit-notes/new?id=${d.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">3-Way Match {report.flaggedCount === 0 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-amber-500" />}</h3>
          <p className="text-[12px] text-slate-400">Ordered × Received × Billed · tolerance ±{report.tolerancePct}% (change in Settings)</p>
        </div>
        {report.flaggedCount > 0 && (
          <button onClick={raiseDebitNote} disabled={busy} className="btn btn-sm text-white" style={{ background: "#DC2626" }}>
            <FileMinus size={13} /> Raise Debit Note for variance
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Ordered", val: money(report.totals.ordered), color: "#6366F1" },
          { label: "Received", val: money(report.totals.received), color: "#0EA5E9" },
          { label: "Billed", val: money(report.totals.billed), color: "#F59E0B" },
          { label: "Debit Noted", val: `−${money(report.totals.debitNoted)}`, color: "#DC2626" },
          { label: "Payable", val: money(report.totals.payable), color: "#10B981" },
        ].map(k => (
          <div key={k.label} className="rounded-lg p-3" style={{ background: k.color + "10", border: "1px solid " + k.color + "30" }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: k.color }}>{k.label}</div>
            <div className="text-[14px] font-bold text-slate-900 nums mt-0.5">{k.val}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="tbl text-[12px]">
          <thead><tr>
            <th>Item</th>
            <th className="right">Ord Qty</th>
            <th className="right">Recv Qty</th>
            <th className="right">Bill Qty</th>
            <th className="right">PO Rate</th>
            <th className="right">Bill Rate</th>
            <th className="right">Qty Δ</th>
            <th className="right">Rate Δ</th>
            <th>Flag</th>
          </tr></thead>
          <tbody>
            {report.lines.map((l, i) => (
              <tr key={i} style={l.flag ? { background: "#FFFBEB" } : {}}>
                <td className="font-medium text-slate-800">{l.itemName}</td>
                <td className="right nums">{l.orderedQty}</td>
                <td className="right nums">{l.receivedQty}</td>
                <td className="right nums">{l.billedQty}</td>
                <td className="right nums">₹{l.poRate}</td>
                <td className="right nums">₹{l.billRate}</td>
                <td className="right nums" style={{ color: Math.abs(l.qtyVariancePct) > report.tolerancePct ? "#DC2626" : "#94A3B8" }}>{l.qtyVariancePct.toFixed(1)}%</td>
                <td className="right nums" style={{ color: Math.abs(l.rateVariancePct) > report.tolerancePct ? "#DC2626" : "#94A3B8" }}>{l.rateVariancePct.toFixed(1)}%</td>
                <td>{l.flag ? <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5" style={{ background: FLAG_COLOR[l.flag] + "20", color: FLAG_COLOR[l.flag] }}>{FLAG_TEXT[l.flag]}</span> : <span className="text-[11px] text-emerald-500">✓</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PurchaseOrderViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <PurchaseOrderView />
    </Suspense>
  );
}
