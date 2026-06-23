import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { aggregateQuoteOutcomes } from "@/lib/advisor/aggregate";

// Decision Advisor learning job. Recomputes the cross-tenant cohort cube from the
// de-identified event log and republishes the (k-anonymized, DP-noised) stats the
// serving layer reads. CRON_SECRET-gated; runs in no tenant context (unscoped).
//
//   GET /api/cron/advisor-aggregate
//   Authorization: Bearer <CRON_SECRET>
async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const result = await aggregateQuoteOutcomes();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
