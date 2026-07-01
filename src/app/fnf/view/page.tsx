"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPut } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { CheckCircle2, Printer } from "lucide-react";
import PageLoading from "@/components/PageLoading";

interface Asset { id: string; assetType: string; tag: string; status: string; value: number; recoveryAmount: number; }
interface Fnf {
  id: string; employeeId: string; status: string; exitReason: string; settlementDate: string; lastWorkingDate: string;
  proRataSalary: number; leaveBalanceDays: number; leaveEncashment: number; leaveEncashmentExempt: number;
  gratuityAmount: number; gratuityExempt: number; bonusPending: number; reimbursementsPending: number;
  noticeShortfallDays: number; noticeRecovery: number; outstandingLoans: number; assetRecovery: number;
  professionalTax: number; tds: number; totalCredits: number; totalDeductions: number; netSettlement: number;
  notes: string;
  employee: { name: string; employeeCode: string; designation: string; department: string; salary: number; dateOfJoining: string | null; email: string; pan: string; };
  assets: Asset[];
}

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function FnfView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [fnf, setFnf] = useState<Fnf | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    apiGet<Fnf>(`/api/fnf/${id}`).then(setFnf).finally(() => setLoading(false));
  }, [id]);

  async function setStatus(status: string) {
    if (!fnf) return;
    setBusy(true);
    try { await apiPut(`/api/fnf/${fnf.id}`, { status }); const fresh = await apiGet<Fnf>(`/api/fnf/${fnf.id}`); setFnf(fresh); toast.success(`Marked ${status}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <PageLoading message="Loading settlement..." />;
  if (!fnf) return <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Settlement not found.</div>;
  const e = fnf.employee;

  return (
    <div className="w-full space-y-4">
      <PageHeader title={`F&F — ${e.name}`}
        breadcrumbs={[{ label: "HR & Payroll" }, { label: "F&F", href: "/fnf" }, { label: e.employeeCode }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold rounded px-1.5 py-0.5" style={{ background: fnf.status === "Paid" ? "#DCFCE7" : fnf.status === "Approved" ? "#DBEAFE" : "#F3F4F6", color: fnf.status === "Paid" ? "#166534" : fnf.status === "Approved" ? "#1E40AF" : "#4B5563" }}>{fnf.status}</span>
            <button onClick={() => window.print()} className="btn btn-outline btn-sm"><Printer size={13} /> Print</button>
            {fnf.status === "Draft" && <button disabled={busy} onClick={() => setStatus("Approved")} className="btn btn-outline btn-sm"><CheckCircle2 size={13} /> Approve</button>}
            {fnf.status !== "Paid" && fnf.status !== "Cancelled" && <button disabled={busy} onClick={() => setStatus("Paid")} className="btn btn-primary btn-sm">Mark Paid</button>}
          </div>
        }
      />

      <div className="card p-6 space-y-6" id="fnf-pdf">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase text-slate-400">Employee</div>
            <div className="text-[15px] font-bold text-slate-900">{e.name}</div>
            <div className="text-[12px] text-slate-500">{e.employeeCode} · {e.designation || "—"} · {e.department || "—"}</div>
            {e.pan && <div className="text-[11px] text-slate-400 mt-1">PAN: {e.pan}</div>}
          </div>
          <div className="text-right text-[12px] text-slate-500">
            <div><b>Exit Reason:</b> {fnf.exitReason}</div>
            <div><b>Date of Joining:</b> {e.dateOfJoining?.split("T")[0] || "—"}</div>
            <div><b>Last Working Date:</b> {fnf.lastWorkingDate?.split("T")[0]}</div>
            <div><b>Settlement Date:</b> {fnf.settlementDate?.split("T")[0]}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[13px] font-bold text-emerald-700 border-b border-emerald-200 pb-1 mb-2">Credits</h3>
            <Row k="Pro-rata Salary" v={fnf.proRataSalary} />
            <Row k={`Leave Encashment (${fnf.leaveBalanceDays} days)`} v={fnf.leaveEncashment} sub={fnf.leaveEncashmentExempt > 0 ? `Exempt §10(10AA): ${money(fnf.leaveEncashmentExempt)}` : undefined} />
            <Row k="Gratuity (§10(10) if ≥5 yrs)" v={fnf.gratuityAmount} sub={fnf.gratuityExempt > 0 ? `Exempt: ${money(fnf.gratuityExempt)} · Cap ₹20L` : "Not eligible"} />
            <Row k="Bonus Pending" v={fnf.bonusPending} />
            <Row k="Reimbursements" v={fnf.reimbursementsPending} />
            <div className="flex justify-between font-bold text-emerald-700 mt-2 pt-2 border-t border-slate-100"><span>Total Credits</span><span className="nums">{money(fnf.totalCredits)}</span></div>
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-red-700 border-b border-red-200 pb-1 mb-2">Deductions</h3>
            <Row k={`Notice Shortfall (${fnf.noticeShortfallDays} days)`} v={fnf.noticeRecovery} />
            <Row k="Outstanding Loans/Advances" v={fnf.outstandingLoans} />
            <Row k="Unreturned Assets" v={fnf.assetRecovery} sub={fnf.assets.filter(a => a.status !== "Returned" && a.status !== "Recovered").map(a => `${a.assetType}${a.tag ? " " + a.tag : ""}`).join(", ") || undefined} />
            <Row k="Professional Tax" v={fnf.professionalTax} />
            <Row k="TDS" v={fnf.tds} />
            <div className="flex justify-between font-bold text-red-700 mt-2 pt-2 border-t border-slate-100"><span>Total Deductions</span><span className="nums">−{money(fnf.totalDeductions)}</span></div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: fnf.netSettlement >= 0 ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${fnf.netSettlement >= 0 ? "#BBF7D0" : "#FECACA"}` }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[12px] font-semibold" style={{ color: fnf.netSettlement >= 0 ? "#166534" : "#991B1B" }}>NET SETTLEMENT {fnf.netSettlement < 0 && "(Recoverable)"}</div>
              <div className="text-[10.5px] text-slate-500 mt-1">Wage components must be paid within 2 working days of LWD (Code on Wages §17(2)); gratuity within 30 days.</div>
            </div>
            <div className="text-[24px] font-bold nums" style={{ color: fnf.netSettlement >= 0 ? "#166534" : "#991B1B" }}>{money(fnf.netSettlement)}</div>
          </div>
        </div>

        {fnf.notes && <div className="text-[12px] text-slate-500 border-t border-slate-100 pt-3"><b>Notes:</b> {fnf.notes}</div>}
      </div>
    </div>
  );
}
function Row({ k, v, sub }: { k: string; v: number; sub?: string }) {
  return <div className="flex justify-between text-[13px] py-1"><div><div className="text-slate-600">{k}</div>{sub && <div className="text-[10.5px] text-slate-400">{sub}</div>}</div><div className="nums text-slate-900">{money(v)}</div></div>;
}
export default function FnfViewPage() {
  return <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading…</div>}><FnfView /></Suspense>;
}
