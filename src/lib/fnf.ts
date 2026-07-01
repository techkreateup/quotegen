// Full & Final settlement calculator (Track C — India compliance).
//
// Credits:
//   - Pro-rata salary from month start → LWD
//   - Leave encashment: (basic+DA)/30 × unusedLeaveDays (exempt up to ₹25L §10(10AA))
//   - Gratuity if ≥ 5 years: (basic+DA) × 15/26 × completedYears (exempt up to ₹20L §10(10))
//   - Pending bonus + reimbursements
// Deductions:
//   - Notice shortfall recovery: (gross/30) × shortfall days
//   - Outstanding loans/advances
//   - Unreturned asset recovery
//   - Professional tax + TDS
//
// All amounts are computed once and stored on FinalSettlement so the statement
// is reproducible years later even if policy inputs change.

export interface FnfInputs {
  monthlyGross: number;
  monthlyBasicDa: number;      // basic + DA for gratuity/LE formulas
  lastWorkingDate: Date;
  dateOfJoining: Date;
  noticePeriodDays: number;
  noticeServedDays: number;
  leaveBalanceDays: number;
  bonusPending: number;
  reimbursementsPending: number;
  outstandingLoans: number;
  assetRecovery: number;
  professionalTax: number;
  tds: number;
}

export interface FnfBreakdown {
  proRataSalary: number;
  leaveEncashment: number;
  leaveEncashmentExempt: number;
  gratuityAmount: number;
  gratuityExempt: number;
  yearsServed: number;
  noticeShortfallDays: number;
  noticeRecovery: number;
  totalCredits: number;
  totalDeductions: number;
  netSettlement: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Statutory exemption caps (India, current). Track separately so future changes
// only touch one place.
const GRATUITY_EXEMPT_CAP = 2_000_000;   // ₹20L §10(10)
const LE_EXEMPT_CAP = 2_500_000;         // ₹25L §10(10AA)

export function computeFnf(i: FnfInputs): FnfBreakdown {
  const lwd = new Date(i.lastWorkingDate);
  // Pro-rata salary = daily × days worked in the exit month.
  const monthStart = new Date(lwd.getFullYear(), lwd.getMonth(), 1);
  const daysInMonth = new Date(lwd.getFullYear(), lwd.getMonth() + 1, 0).getDate();
  const daysWorked = Math.max(0, Math.floor((lwd.getTime() - monthStart.getTime()) / 86400_000) + 1);
  const proRataSalary = round2((i.monthlyGross / daysInMonth) * daysWorked);

  // Leave encashment.
  const dailyBasicDa = i.monthlyBasicDa / 30;
  const leaveEncashment = round2(dailyBasicDa * Math.max(0, i.leaveBalanceDays));
  const leaveEncashmentExempt = Math.min(leaveEncashment, LE_EXEMPT_CAP);

  // Gratuity (only if ≥ 5 completed years).
  const ms = lwd.getTime() - new Date(i.dateOfJoining).getTime();
  const yearsServed = ms / (365.25 * 86400_000);
  const completedYears = Math.floor(yearsServed);
  const gratuityAmount = completedYears >= 5
    ? round2(i.monthlyBasicDa * (15 / 26) * completedYears)
    : 0;
  const gratuityExempt = Math.min(gratuityAmount, GRATUITY_EXEMPT_CAP);

  // Notice recovery.
  const noticeShortfallDays = Math.max(0, i.noticePeriodDays - i.noticeServedDays);
  const noticeRecovery = round2((i.monthlyGross / 30) * noticeShortfallDays);

  const totalCredits = round2(
    proRataSalary + leaveEncashment + gratuityAmount + i.bonusPending + i.reimbursementsPending
  );
  const totalDeductions = round2(
    noticeRecovery + i.outstandingLoans + i.assetRecovery + i.professionalTax + i.tds
  );
  const netSettlement = round2(totalCredits - totalDeductions);

  return {
    proRataSalary, leaveEncashment, leaveEncashmentExempt,
    gratuityAmount, gratuityExempt, yearsServed: round2(yearsServed),
    noticeShortfallDays, noticeRecovery,
    totalCredits, totalDeductions, netSettlement,
  };
}
