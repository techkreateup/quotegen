import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { computeFnf } from "@/lib/fnf";
import { logAudit } from "@/lib/audit";

async function GET_handler(_req: NextRequest) {
  const rows = await prisma.finalSettlement.findMany({
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true, employeeCode: true, designation: true, department: true } } },
  });
  return NextResponse.json(rows);
}

// POST /api/fnf — create draft F&F for an employee. Body: { employeeId,
// lastWorkingDate, exitReason?, noticeServedDays?, leaveBalanceDays?, bonusPending?,
// reimbursementsPending?, outstandingLoans?, professionalTax?, tds?, basicDaOverride? }
async function POST_handler(req: NextRequest) {
  const body = await req.json();
  const { employeeId } = body;
  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!emp.dateOfJoining) return NextResponse.json({ error: "Employee has no date of joining" }, { status: 400 });

  const lwd = body.lastWorkingDate ? new Date(body.lastWorkingDate) : (emp.lastWorkingDate ?? new Date());
  // Basic+DA typically 50-60% of gross; default 50% unless overridden.
  const monthlyBasicDa = Number(body.basicDaOverride ?? emp.salary * 0.5);

  // Unreturned assets → auto recovery.
  const assets = await prisma.employeeAsset.findMany({ where: { employeeId, status: { in: ["Issued", "Lost", "Damaged"] } } });
  const assetRecovery = assets.reduce((s, a) => s + (a.recoveryAmount || a.value || 0), 0);

  const inputs = {
    monthlyGross: emp.salary,
    monthlyBasicDa,
    lastWorkingDate: lwd,
    dateOfJoining: emp.dateOfJoining,
    noticePeriodDays: emp.noticePeriodDays,
    noticeServedDays: Number(body.noticeServedDays ?? 0),
    leaveBalanceDays: Number(body.leaveBalanceDays ?? 0),
    bonusPending: Number(body.bonusPending ?? 0),
    reimbursementsPending: Number(body.reimbursementsPending ?? 0),
    outstandingLoans: Number(body.outstandingLoans ?? 0),
    assetRecovery,
    professionalTax: Number(body.professionalTax ?? 0),
    tds: Number(body.tds ?? 0),
  };
  const b = computeFnf(inputs);

  const fnf = await prisma.finalSettlement.upsert({
    where: { employeeId },
    create: {
      companyId: requireCompanyId(), employeeId,
      settlementDate: new Date(), exitReason: body.exitReason || "Resignation",
      lastWorkingDate: lwd,
      proRataSalary: b.proRataSalary,
      leaveBalanceDays: inputs.leaveBalanceDays,
      leaveEncashment: b.leaveEncashment, leaveEncashmentExempt: b.leaveEncashmentExempt,
      gratuityAmount: b.gratuityAmount, gratuityExempt: b.gratuityExempt,
      bonusPending: inputs.bonusPending, reimbursementsPending: inputs.reimbursementsPending,
      noticeShortfallDays: b.noticeShortfallDays, noticeRecovery: b.noticeRecovery,
      outstandingLoans: inputs.outstandingLoans, assetRecovery,
      professionalTax: inputs.professionalTax, tds: inputs.tds,
      totalCredits: b.totalCredits, totalDeductions: b.totalDeductions, netSettlement: b.netSettlement,
      status: "Draft",
      notes: body.notes || "",
    } as never,
    update: {
      settlementDate: new Date(), exitReason: body.exitReason || "Resignation",
      lastWorkingDate: lwd,
      proRataSalary: b.proRataSalary,
      leaveBalanceDays: inputs.leaveBalanceDays,
      leaveEncashment: b.leaveEncashment, leaveEncashmentExempt: b.leaveEncashmentExempt,
      gratuityAmount: b.gratuityAmount, gratuityExempt: b.gratuityExempt,
      bonusPending: inputs.bonusPending, reimbursementsPending: inputs.reimbursementsPending,
      noticeShortfallDays: b.noticeShortfallDays, noticeRecovery: b.noticeRecovery,
      outstandingLoans: inputs.outstandingLoans, assetRecovery,
      professionalTax: inputs.professionalTax, tds: inputs.tds,
      totalCredits: b.totalCredits, totalDeductions: b.totalDeductions, netSettlement: b.netSettlement,
    } as never,
  });

  logAudit({ userId: req.headers.get("x-user-id") || "system", entity: "FinalSettlement", entityId: fnf.id, action: "CREATE", after: { employeeId, netSettlement: b.netSettlement } });
  return NextResponse.json(fnf, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
