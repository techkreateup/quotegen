"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Client, Quotation, Invoice, PaymentReceipt } from "@/lib/types";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { FileText, Receipt, CreditCard, IndianRupee, ArrowLeft, Phone, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import ActivityTimeline from "@/components/ActivityTimeline";
import EntityNotes from "@/components/EntityNotes";
import PageLoading from "@/components/PageLoading";

function ClientView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [client, setClient]     = useState<Client | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [receipts, setReceipts]   = useState<PaymentReceipt[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    async function load() {
      try {
        const [c, allQuotations, allInvoices, allReceipts] = await Promise.all([
          apiGet<Client>(`/api/clients/${id}`),
          apiGet<Quotation[]>("/api/quotations"),
          apiGet<Invoice[]>("/api/invoices"),
          apiGet<PaymentReceipt[]>("/api/receipts"),
        ]);
        if (c) {
          const status = (c.status as string) === "AtRisk" ? "At Risk" : c.status;
          setClient({ ...c, status } as Client);
        }
        if (allQuotations) setQuotations(allQuotations.filter((q) => q.clientId === id));
        if (allInvoices)   setInvoices(allInvoices.filter((i) => i.clientId === id));
        if (allReceipts)   setReceipts(allReceipts.filter((r) => r.clientId === id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <PageLoading message="Loading client..." />;
  if (!client) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Client not found.</div>;

  const totalBilled  = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid    = receipts.reduce((s, r) => s + r.amount, 0);
  const outstanding  = totalBilled - totalPaid;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={client.businessName}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Clients", href: "/clients" }, { label: client.businessName }]}
        action={<Link href="/clients" className="btn btn-outline btn-sm"><ArrowLeft size={14} /> Back</Link>}
      />

      {/* Client Info + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info Card */}
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-5">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="av av-lg shrink-0 text-white" style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", borderRadius: 12 }}>
                {client.businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-[16px] font-bold text-slate-900 leading-tight">{client.businessName}</h2>
              {client.industry && <p className="text-[12px] text-slate-500 mt-0.5">{client.industry}</p>}
              <div className="mt-1.5"><StatusBadge status={client.status} /></div>
            </div>
          </div>
          <div className="space-y-2.5 text-[12.5px]">
            {client.phones?.filter(Boolean).map((ph, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-600"><Phone size={13} className="text-slate-400 shrink-0" />{ph}</div>
            ))}
            {client.email && (
              <div className="flex items-center gap-2 text-slate-600"><Mail size={13} className="text-slate-400 shrink-0" />{client.email}</div>
            )}
            {client.address && (
              <div className="flex items-start gap-2 text-slate-600"><MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />{client.address}</div>
            )}
            {client.gstin && <p className="text-slate-500">GSTIN: <span className="font-mono">{client.gstin}</span></p>}
            {client.pan  && <p className="text-slate-500">PAN: <span className="font-mono">{client.pan}</span></p>}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { icon: FileText,     color: "#4F46E5", bg: "#EEF2FF", label: "Quotations",  value: quotations.length,                           numColor: undefined },
            { icon: Receipt,      color: "#7C3AED", bg: "#F5F3FF", label: "Invoices",    value: invoices.length,                              numColor: undefined },
            { icon: IndianRupee,  color: "#059669", bg: "#ECFDF5", label: "Total Paid",  value: `₹${totalPaid.toLocaleString("en-IN")}`,       numColor: "text-emerald-600" },
            { icon: CreditCard,   color: "#DC2626", bg: "#FEF2F2", label: "Outstanding", value: `₹${outstanding.toLocaleString("en-IN")}`,     numColor: outstanding > 0 ? "text-rose-600" : undefined },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <div style={{ width: 34, height: 34, borderRadius: 8, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <stat.icon size={16} color={stat.color} strokeWidth={2} />
              </div>
              <div className={`text-[20px] font-800 nums tracking-tight ${stat.numColor || "text-slate-900"}`} style={{ fontWeight: 800 }}>
                {stat.value}
              </div>
              <p className="text-[11.5px] text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quotations */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAECF0]" style={{ background: "#FAFBFD" }}>
          <span className="font-bold text-slate-900 text-[14px]">Quotations ({quotations.length})</span>
          <Link href="/quotations/new" className="btn btn-outline btn-sm">+ New Quotation</Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Date</th><th>No.</th><th className="right">Amount</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-[13px] text-slate-400">No quotations yet.</td></tr>
              ) : quotations.map((q) => (
                <tr key={q.id}>
                  <td className="text-[12px]">{formatDate(q.quotationDate)}</td>
                  <td className="font-semibold text-indigo-600 text-[13px]">{q.quotationNo}</td>
                  <td className="text-right font-semibold nums text-[13px]">₹{q.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td><Link href={`/quotations/view?id=${q.id}`} className="act" title="View"><FileText size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAECF0]" style={{ background: "#FAFBFD" }}>
          <span className="font-bold text-slate-900 text-[14px]">Invoices ({invoices.length})</span>
          <Link href="/invoices/new" className="btn btn-outline btn-sm">+ New Invoice</Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Date</th><th>No.</th><th className="right">Amount</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-[13px] text-slate-400">No invoices yet.</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="text-[12px]">{formatDate(inv.invoiceDate)}</td>
                  <td className="font-semibold text-indigo-600 text-[13px]">{inv.invoiceNo}</td>
                  <td className="text-right font-semibold nums text-[13px]">₹{inv.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td><Link href={`/invoices/view?id=${inv.id}`} className="act" title="View"><Receipt size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Receipts */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EAECF0]" style={{ background: "#FAFBFD" }}>
          <span className="font-bold text-slate-900 text-[14px]">Payment Receipts ({receipts.length})</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Date</th><th>No.</th><th className="right">Amount</th><th>Method</th><th></th>
            </tr></thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-[13px] text-slate-400">No payments yet.</td></tr>
              ) : receipts.map((r) => (
                <tr key={r.id}>
                  <td className="text-[12px]">{formatDate(r.receiptDate)}</td>
                  <td className="font-semibold text-indigo-600 text-[13px]">{r.receiptNo}</td>
                  <td className="text-right font-semibold nums text-emerald-600 text-[13px]">₹{r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td><span className="text-[11.5px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{r.paymentMethod}</span></td>
                  <td><Link href={`/payment-receipts/view?id=${r.id}`} className="act" title="View"><CreditCard size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline entityType="Client" entityId={client.id} />

      {/* Notes */}
      <EntityNotes entityType="Client" entityId={client.id} />
    </div>
  );
}

export default function ClientViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}>
      <ClientView />
    </Suspense>
  );
}
