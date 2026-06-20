import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";
import { transitionSubscription, GRACE_PERIOD_DAYS } from "@/lib/subscription";
import { sendEmail, trialReminderEmail } from "@/lib/email";

// Daily billing-lifecycle sweep. CRON_SECRET-gated (same pattern as the other
// cron routes). Runs across ALL companies via the unscoped client.
//
//   GET /api/cron/subscription-check
//   Authorization: Bearer <CRON_SECRET>
//
// • TRIALING whose trialEndsAt has passed  → FREE
// • PAST_DUE older than the grace window   → CANCELED
async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const now = new Date();
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 86_400_000);

  // Expired trials → FREE.
  const expiredTrials = await prismaUnscoped.company.findMany({
    where: { subscriptionStatus: "TRIALING", trialEndsAt: { lt: now } },
    select: { id: true },
  });

  // PAST_DUE past the grace period → CANCELED (use updatedAt as the lapse marker).
  const lapsed = await prismaUnscoped.company.findMany({
    where: { subscriptionStatus: "PAST_DUE", updatedAt: { lt: graceCutoff } },
    select: { id: true },
  });

  let trialsExpired = 0;
  let canceled = 0;
  for (const c of expiredTrials) {
    try {
      await transitionSubscription(c.id, "FREE", { planId: null, trialEndsAt: null });
      trialsExpired++;
    } catch (err) {
      console.warn(`[subscription-check] trial→FREE failed for ${c.id}:`, (err as Error).message);
    }
  }
  for (const c of lapsed) {
    try {
      await transitionSubscription(c.id, "CANCELED");
      canceled++;
    } catch (err) {
      console.warn(`[subscription-check] past_due→CANCELED failed for ${c.id}:`, (err as Error).message);
    }
  }

  // Trial-ending reminders at 7 / 3 / 1 days out (TRIALING with a future trialEndsAt).
  const appUrl = process.env.APP_URL || "";
  let reminders = 0;
  for (const days of [7, 3, 1]) {
    const dayStart = new Date(now.getTime() + days * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const ending = await prismaUnscoped.company.findMany({
      where: { subscriptionStatus: "TRIALING", trialEndsAt: { gte: dayStart, lt: dayEnd } },
      select: { id: true, settings: { select: { email: true, businessName: true } } },
    });
    for (const c of ending) {
      if (!c.settings?.email) continue;
      await sendEmail({
        to: c.settings.email,
        subject: `${days} day${days === 1 ? "" : "s"} left in your QuoteGen trial`,
        html: trialReminderEmail(c.settings.businessName || "there", days, `${appUrl}/plans`),
      }).then((sent) => { if (sent) reminders++; }).catch(() => {});
    }
  }

  console.log(`[subscription-check] ${trialsExpired} trial(s) expired, ${canceled} canceled, ${reminders} reminder(s)`);
  return NextResponse.json({ trialsExpired, canceled, reminders });
}

export const GET = run;
