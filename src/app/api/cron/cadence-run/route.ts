import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { runWithTenant } from "@/lib/tenant-context";
import { runCadencesForCompany } from "@/lib/cadence";
import { cronAuthError } from "@/lib/cron-auth";

// Daily cadence dispatcher: advances every active CadenceEnrollment and sends
// any step whose scheduled date has arrived (dunning, quote follow-ups). Public
// to the proxy but gated by CRON_SECRET (fail-closed in prod). Idempotent via
// MessageLog.dedupeKey, so re-running the same day never double-sends.
//
//   GET /api/cron/cadence-run
//   Authorization: Bearer <CRON_SECRET>
async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const companies = await prismaUnscoped.company.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let sent = 0, advanced = 0, stopped = 0, companiesRun = 0;
  for (const c of companies) {
    try {
      const r = await runWithTenant({ companyId: c.id, userId: "system" }, () => runCadencesForCompany());
      sent += r.sent; advanced += r.advanced; stopped += r.stopped; companiesRun++;
    } catch (err) {
      console.error("[cron:cadence-run] company failed:", c.id, err);
    }
  }

  return NextResponse.json({ ok: true, companiesRun, sent, advanced, stopped });
}

export const GET = run;
export const POST = run;
