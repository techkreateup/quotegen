import { NextRequest, NextResponse } from "next/server";
import { runWithTenant } from "@/lib/tenant-context";
import { nudgeInactive } from "@/lib/nudge";
import { cronAuthError } from "@/lib/cron-auth";

// Scheduled re-engagement of inactive companies. Triggered by a cron (see
// vercel.json) or any external scheduler. Protected by CRON_SECRET — this route
// is public to the proxy but rejects requests without the secret.
//
//   GET /api/cron/nudge-inactive?days=30
//   Authorization: Bearer <CRON_SECRET>
async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const days = Number(request.nextUrl.searchParams.get("days")) || 30;
  // notifyCompany / audit use the scoped Prisma client for AuditLog (nullable
  // companyId), so run inside a platform tenant context.
  const result = await runWithTenant({ companyId: null, userId: "system" }, () =>
    nudgeInactive({ days, adminId: "system" })
  );
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
