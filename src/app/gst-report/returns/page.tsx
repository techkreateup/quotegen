"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import {
  Download, FileText, ArrowLeft, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import Link from "next/link";

// ── Types ──
interface B2BRow { id: string; gstin: string; clientName: string; invoiceNo: string; invoiceDate: string; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface B2CRow { state: string; rate: number; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface CNRow { creditNoteNo: string; creditNoteDate: string; clientName: string; gstin: string; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface Totals { taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface HsnRow { hsnSac: string; description: string; quantity: number; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface B2CInvoice { id: string; clientName: string; invoiceNo: string; invoiceDate: string; state: string; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }
interface GSTR1Data { b2b: B2BRow[]; b2c: B2CRow[]; b2cList: B2CInvoice[]; creditNotes: CNRow[]; hsnSummary: HsnRow[]; b2bTotals: Totals; b2cTotals: Totals; cnTotals: Totals }
interface GSTR3BData { table3_1: Totals; table3_2: { taxableValue: number; igst: number }; creditNoteAdjustment: { igst: number; cgst: number; sgst: number }; itc: { igst: number; cgst: number; sgst: number; total: number }; netTaxLiability: { igst: number; cgst: number; sgst: number; total: number } }

const MONTH_FULL = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function MonthlyReturnsPage() {
  const sp = useSearchParams();
  const month = parseInt(sp.get("month") || "0");
  const year = parseInt(sp.get("year") || "0");

  const [tab, setTab] = useState<"gstr1" | "gstr3b">("gstr1");
  const [gstr1, setGstr1] = useState<GSTR1Data | null>(null);
  const [gstr3b, setGstr3b] = useState<GSTR3BData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!month || !year) return;
    setLoading(true);
    Promise.all([
      apiGet<GSTR1Data>(`/api/gst-report?month=${month}&year=${year}&type=gstr1`),
      apiGet<GSTR3BData>(`/api/gst-report?month=${month}&year=${year}&type=gstr3b`),
    ]).then(([r1, r3]) => {
      setGstr1(r1);
      setGstr3b(r3);
    }).finally(() => setLoading(false));
  }, [month, year]);

  function exportCSV() {
    if (tab === "gstr1" && gstr1) {
      const headers = ["Section","GSTIN","Client","Invoice/CN No","Date","Taxable Value","IGST","CGST","SGST","Total"];
      const rows: unknown[][] = [];
      gstr1.b2b.forEach(r => rows.push(["B2B", r.gstin, r.clientName, r.invoiceNo, r.invoiceDate, r.taxableValue, r.igst, r.cgst, r.sgst, r.total]));
      rows.push(["B2B Total","","","","", gstr1.b2bTotals.taxableValue, gstr1.b2bTotals.igst, gstr1.b2bTotals.cgst, gstr1.b2bTotals.sgst, gstr1.b2bTotals.total]);
      gstr1.b2c.forEach(r => rows.push(["B2C", "", r.state, `Rate: ${r.rate}%`, "", r.taxableValue, r.igst, r.cgst, r.sgst, r.total]));
      rows.push(["B2C Total","","","","", gstr1.b2cTotals.taxableValue, gstr1.b2cTotals.igst, gstr1.b2cTotals.cgst, gstr1.b2cTotals.sgst, gstr1.b2cTotals.total]);
      gstr1.creditNotes.forEach(r => rows.push(["Credit Note", r.gstin, r.clientName, r.creditNoteNo, r.creditNoteDate, r.taxableValue, r.igst, r.cgst, r.sgst, r.total]));
      downloadCSV(`GSTR1_${year}_${month}.csv`, headers, rows);
    } else if (tab === "gstr3b" && gstr3b) {
      const headers = ["Description","IGST","CGST","SGST","Total"];
      const rows: unknown[][] = [
        ["3.1 Outward Supplies", gstr3b.table3_1.igst, gstr3b.table3_1.cgst, gstr3b.table3_1.sgst, gstr3b.table3_1.total],
        ["3.2 Inter-State Unregistered", gstr3b.table3_2.igst, "", "", gstr3b.table3_2.igst],
        ["Credit Note Adjustment", gstr3b.creditNoteAdjustment.igst, gstr3b.creditNoteAdjustment.cgst, gstr3b.creditNoteAdjustment.sgst, ""],
        ["Net Tax Liability", gstr3b.netTaxLiability.igst, gstr3b.netTaxLiability.cgst, gstr3b.netTaxLiability.sgst, gstr3b.netTaxLiability.total],
      ];
      downloadCSV(`GSTR3B_${year}_${month}.csv`, headers, rows);
    }
  }

  if (!month || !year) return <div className="p-10 text-center text-slate-400">Invalid period. Go back to GST Returns.</div>;

  const periodLabel = `${MONTH_FULL[month]} ${year}`;

  // Compute summary numbers from data
  const b2bTotal = gstr1 ? gstr1.b2bTotals.total : 0;
  const b2cTotal = gstr1 ? gstr1.b2cTotals.total : 0;
  const netLiability = gstr3b ? gstr3b.netTaxLiability.total : 0;
  const b2bCount = gstr1 ? gstr1.b2b.length : 0;
  const b2cCount = gstr1 ? gstr1.b2c.length : 0;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={`GST Returns — ${periodLabel}`}
        subtitle="Monthly GSTR-1 and GSTR-3B report details"
        breadcrumbs={[
          { label: "GST Returns", href: "/gst-report" },
          { label: periodLabel },
        ]}
        action={
          <Link href="/gst-report" className="btn btn-outline btn-sm">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        }
      />

      {loading && <PageLoading message="Generating reports..." />}

      {!loading && (
        <>
          {/* ── Summary Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">B2B Invoices</p>
              <p className="text-[22px] font-bold text-blue-600 mt-1">{b2bCount}</p>
              <p className="text-[11px] text-slate-400">Total: {fmt(b2bTotal)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">B2C Supplies</p>
              <p className="text-[22px] font-bold text-orange-600 mt-1">{b2cCount}</p>
              <p className="text-[11px] text-slate-400">Total: {fmt(b2cTotal)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Credit Notes</p>
              <p className="text-[22px] font-bold text-slate-600 mt-1">{gstr1?.creditNotes.length || 0}</p>
              <p className="text-[11px] text-slate-400">Total: {fmt(gstr1?.cnTotals.total || 0)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Net Tax Liability</p>
              <p className="text-[22px] font-bold text-indigo-600 mt-1">{fmt(netLiability)}</p>
              <p className="text-[11px] text-slate-400">IGST + CGST + SGST</p>
            </div>
          </div>

          {/* ── Tab Switcher ── */}
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setTab("gstr1")}
                className={`px-5 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                  tab === "gstr1" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <FileText size={14} className="inline mr-1.5 -mt-0.5" />
                GSTR-1 (Sales)
              </button>
              <button
                onClick={() => setTab("gstr3b")}
                className={`px-5 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                  tab === "gstr3b" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <FileText size={14} className="inline mr-1.5 -mt-0.5" />
                GSTR-3B (Summary)
              </button>
            </div>
            <button onClick={exportCSV} className="btn btn-outline btn-sm">
              <Download size={13} /> Export CSV
            </button>
          </div>

          {/* ── GSTR-1 Content ── */}
          {tab === "gstr1" && gstr1 && (
            <div className="space-y-6">
              {/* B2B Supplies */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="text-[14px] font-bold text-slate-800">B2B Supplies</h3>
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{gstr1.b2b.length} invoices</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-slate-400">GST collected from customer</span>
                    <ArrowUpRight size={14} className="text-blue-500" />
                  </div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>GSTIN</th><th>Client</th><th>Invoice No</th><th>Date</th>
                        <th className="text-right">Taxable</th><th className="text-right">IGST</th>
                        <th className="text-right">CGST</th><th className="text-right">SGST</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1.b2b.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-slate-400 py-6">No B2B invoices this month</td></tr>
                      ) : gstr1.b2b.map((r, i) => (
                        <tr key={i}>
                          <td className="font-mono text-[11px]">{r.gstin}</td>
                          <td className="font-semibold">{r.clientName}</td>
                          <td><Link href={`/invoices/view?id=${r.id}`} className="text-indigo-600 font-semibold hover:underline">{r.invoiceNo}</Link></td>
                          <td className="text-slate-500">{r.invoiceDate}</td>
                          <td className="text-right">{fmt(r.taxableValue)}</td>
                          <td className="text-right">{fmt(r.igst)}</td>
                          <td className="text-right">{fmt(r.cgst)}</td>
                          <td className="text-right">{fmt(r.sgst)}</td>
                          <td className="text-right font-bold">{fmt(r.total)}</td>
                        </tr>
                      ))}
                      {gstr1.b2b.length > 0 && (
                        <tr className="font-bold bg-blue-50/50 border-t-2 border-blue-100">
                          <td colSpan={4} className="text-right text-blue-700">B2B Total</td>
                          <td className="text-right text-blue-700">{fmt(gstr1.b2bTotals.taxableValue)}</td>
                          <td className="text-right text-blue-700">{fmt(gstr1.b2bTotals.igst)}</td>
                          <td className="text-right text-blue-700">{fmt(gstr1.b2bTotals.cgst)}</td>
                          <td className="text-right text-blue-700">{fmt(gstr1.b2bTotals.sgst)}</td>
                          <td className="text-right text-blue-700">{fmt(gstr1.b2bTotals.total)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B2C Supplies */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <h3 className="text-[14px] font-bold text-slate-800">B2C Supplies</h3>
                    <span className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-semibold">{gstr1.b2c.length} entries</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-slate-400">GST you pay from pocket</span>
                    <ArrowDownRight size={14} className="text-orange-500" />
                  </div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>State</th><th>Rate</th>
                        <th className="text-right">Taxable</th><th className="text-right">IGST</th>
                        <th className="text-right">CGST</th><th className="text-right">SGST</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1.b2c.length === 0 ? (
                        <tr><td colSpan={7} className="text-center text-slate-400 py-6">No B2C supplies this month</td></tr>
                      ) : gstr1.b2c.map((r, i) => (
                        <tr key={i}>
                          <td className="font-semibold">{r.state}</td>
                          <td><span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">{r.rate}%</span></td>
                          <td className="text-right">{fmt(r.taxableValue)}</td>
                          <td className="text-right">{fmt(r.igst)}</td>
                          <td className="text-right">{fmt(r.cgst)}</td>
                          <td className="text-right">{fmt(r.sgst)}</td>
                          <td className="text-right font-bold">{fmt(r.total)}</td>
                        </tr>
                      ))}
                      {gstr1.b2c.length > 0 && (
                        <tr className="font-bold bg-orange-50/50 border-t-2 border-orange-100">
                          <td colSpan={2} className="text-right text-orange-700">B2C Total</td>
                          <td className="text-right text-orange-700">{fmt(gstr1.b2cTotals.taxableValue)}</td>
                          <td className="text-right text-orange-700">{fmt(gstr1.b2cTotals.igst)}</td>
                          <td className="text-right text-orange-700">{fmt(gstr1.b2cTotals.cgst)}</td>
                          <td className="text-right text-orange-700">{fmt(gstr1.b2cTotals.sgst)}</td>
                          <td className="text-right text-orange-700">{fmt(gstr1.b2cTotals.total)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B2C Invoice List */}
              {gstr1.b2cList && gstr1.b2cList.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                    <h3 className="text-[14px] font-bold text-slate-800">B2C Invoice Details</h3>
                    <span className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-semibold">{gstr1.b2cList.length} invoices</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Client</th><th>Invoice No</th><th>Date</th><th>State</th>
                          <th className="text-right">Taxable</th><th className="text-right">IGST</th>
                          <th className="text-right">CGST</th><th className="text-right">SGST</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1.b2cList.map((r, i) => (
                          <tr key={i}>
                            <td className="font-semibold">{r.clientName}</td>
                            <td><Link href={`/invoices/view?id=${r.id}`} className="text-orange-600 font-semibold hover:underline">{r.invoiceNo}</Link></td>
                            <td className="text-slate-500">{r.invoiceDate}</td>
                            <td className="text-slate-500">{r.state}</td>
                            <td className="text-right">{fmt(r.taxableValue)}</td>
                            <td className="text-right">{fmt(r.igst)}</td>
                            <td className="text-right">{fmt(r.cgst)}</td>
                            <td className="text-right">{fmt(r.sgst)}</td>
                            <td className="text-right font-bold">{fmt(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Credit Notes */}
              {gstr1.creditNotes.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <h3 className="text-[14px] font-bold text-slate-800">Credit / Debit Notes</h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{gstr1.creditNotes.length}</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>CN No</th><th>Date</th><th>Client</th><th>GSTIN</th>
                          <th className="text-right">Taxable</th><th className="text-right">IGST</th>
                          <th className="text-right">CGST</th><th className="text-right">SGST</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1.creditNotes.map((r, i) => (
                          <tr key={i}>
                            <td className="font-semibold">{r.creditNoteNo}</td>
                            <td className="text-slate-500">{r.creditNoteDate}</td>
                            <td>{r.clientName}</td>
                            <td className="font-mono text-[11px]">{r.gstin || "—"}</td>
                            <td className="text-right">{fmt(r.taxableValue)}</td>
                            <td className="text-right">{fmt(r.igst)}</td>
                            <td className="text-right">{fmt(r.cgst)}</td>
                            <td className="text-right">{fmt(r.sgst)}</td>
                            <td className="text-right font-bold">{fmt(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HSN Summary */}
              {gstr1.hsnSummary && gstr1.hsnSummary.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h3 className="text-[14px] font-bold text-slate-800">HSN Summary</h3>
                    <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">{gstr1.hsnSummary.length} codes</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>HSN/SAC</th><th>Description</th><th className="text-right">Qty</th>
                          <th className="text-right">Taxable</th><th className="text-right">IGST</th>
                          <th className="text-right">CGST</th><th className="text-right">SGST</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1.hsnSummary.map((h, i) => (
                          <tr key={i}>
                            <td><span className="font-mono text-[12px] bg-slate-100 px-2 py-0.5 rounded">{h.hsnSac}</span></td>
                            <td className="text-slate-600 text-[12px]">{h.description}</td>
                            <td className="text-right">{h.quantity}</td>
                            <td className="text-right">{fmt(h.taxableValue)}</td>
                            <td className="text-right">{fmt(h.igst)}</td>
                            <td className="text-right">{fmt(h.cgst)}</td>
                            <td className="text-right">{fmt(h.sgst)}</td>
                            <td className="text-right font-bold">{fmt(h.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GSTR-3B Content ── */}
          {tab === "gstr3b" && gstr3b && (
            <div className="space-y-6">
              {/* 3.1 Outward Supplies */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[12px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">3.1</span>
                  <h3 className="text-[14px] font-bold text-slate-800">Outward Supplies</h3>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Nature</th><th className="text-right">Taxable</th><th className="text-right">IGST</th><th className="text-right">CGST</th><th className="text-right">SGST</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-semibold">Outward taxable supplies</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.taxableValue)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.igst)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.cgst)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.sgst)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3.2 Inter-State */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[12px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">3.2</span>
                  <h3 className="text-[14px] font-bold text-slate-800">Inter-State to Unregistered</h3>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Description</th><th className="text-right">Taxable</th><th className="text-right">IGST</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-semibold">Supplies to unregistered persons</td>
                        <td className="text-right">{fmt(gstr3b.table3_2.taxableValue)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_2.igst)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Tax Liability */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[12px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded">Tax</span>
                  <h3 className="text-[14px] font-bold text-slate-800">Net Tax Liability</h3>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Description</th><th className="text-right">IGST</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Total Tax on Outward Supplies</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.igst)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.cgst)}</td>
                        <td className="text-right">{fmt(gstr3b.table3_1.sgst)}</td>
                        <td className="text-right font-semibold">{fmt(gstr3b.table3_1.igst + gstr3b.table3_1.cgst + gstr3b.table3_1.sgst)}</td>
                      </tr>
                      <tr>
                        <td className="text-red-600">Less: Credit Note Adjustment</td>
                        <td className="text-right text-red-600">{fmt(gstr3b.creditNoteAdjustment.igst)}</td>
                        <td className="text-right text-red-600">{fmt(gstr3b.creditNoteAdjustment.cgst)}</td>
                        <td className="text-right text-red-600">{fmt(gstr3b.creditNoteAdjustment.sgst)}</td>
                        <td className="text-right text-red-600 font-semibold">{fmt(gstr3b.creditNoteAdjustment.igst + gstr3b.creditNoteAdjustment.cgst + gstr3b.creditNoteAdjustment.sgst)}</td>
                      </tr>
                      {gstr3b.itc && gstr3b.itc.total > 0 && (
                        <tr>
                          <td className="text-emerald-600">Less: Input Tax Credit (ITC)</td>
                          <td className="text-right text-emerald-600">{fmt(gstr3b.itc.igst)}</td>
                          <td className="text-right text-emerald-600">{fmt(gstr3b.itc.cgst)}</td>
                          <td className="text-right text-emerald-600">{fmt(gstr3b.itc.sgst)}</td>
                          <td className="text-right text-emerald-600 font-semibold">{fmt(gstr3b.itc.total)}</td>
                        </tr>
                      )}
                      <tr className="bg-indigo-50 font-bold text-indigo-900">
                        <td>Net Tax Liability</td>
                        <td className="text-right">{fmt(gstr3b.netTaxLiability.igst)}</td>
                        <td className="text-right">{fmt(gstr3b.netTaxLiability.cgst)}</td>
                        <td className="text-right">{fmt(gstr3b.netTaxLiability.sgst)}</td>
                        <td className="text-right">{fmt(gstr3b.netTaxLiability.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && !gstr1 && !gstr3b && (
            <div className="card px-5 py-12 text-center">
              <p className="text-slate-400 text-[14px]">No invoice data found for {periodLabel}.</p>
              <p className="text-slate-300 text-[12px] mt-1">Reports are generated from your invoices. Create invoices first.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
