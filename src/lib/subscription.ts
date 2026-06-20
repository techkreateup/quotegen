import { prismaUnscoped } from "@/lib/db";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { invalidateCompanyCache } from "@/lib/with-api";

// Grace period before a PAST_DUE subscription is canceled.
export const GRACE_PERIOD_DAYS = 7;

/**
 * Allowed state transitions for a company's billing subscription.
 *   TRIALING → ACTIVE      (first successful payment)
 *   TRIALING → FREE        (trial expired without payment)
 *   ACTIVE   → PAST_DUE    (payment failed, grace period starts)
 *   ACTIVE   → CANCELED    (manual cancel)
 *   PAST_DUE → ACTIVE      (retry payment succeeds)
 *   PAST_DUE → CANCELED    (grace period expired)
 *   CANCELED → ACTIVE      (re-subscribe)
 *   FREE     → ACTIVE/TRIALING (start a plan)
 */
const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIALING: ["ACTIVE", "FREE", "CANCELED"],
  ACTIVE: ["PAST_DUE", "CANCELED"],
  PAST_DUE: ["ACTIVE", "CANCELED"],
  CANCELED: ["ACTIVE", "TRIALING"],
  FREE: ["ACTIVE", "TRIALING"],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: SubscriptionStatus, to: SubscriptionStatus) {
    super(`Invalid subscription transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Transition a company to a new subscription status, enforcing the state
 * machine. Optionally updates the plan and trial fields. Uses the unscoped
 * client so it can run from webhooks/cron where there is no tenant context.
 */
export async function transitionSubscription(
  companyId: string,
  to: SubscriptionStatus,
  opts: { planId?: string | null; trialEndsAt?: Date | null; razorpaySubscriptionId?: string } = {}
) {
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, plan: true },
  });
  if (!company) throw new Error(`Company ${companyId} not found`);

  const from = company.subscriptionStatus;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }

  const data: Record<string, unknown> = { subscriptionStatus: to };
  if (opts.planId !== undefined) {
    data.currentPlanId = opts.planId;
    if (opts.planId) data.plan = opts.planId; // keep legacy `plan` string in sync
  }
  if (opts.trialEndsAt !== undefined) data.trialEndsAt = opts.trialEndsAt;
  if (opts.razorpaySubscriptionId !== undefined) {
    data.razorpaySubscriptionId = opts.razorpaySubscriptionId;
  }
  // Active again after a lapse should clear the trial deadline.
  if (to === "ACTIVE") data.trialEndsAt = opts.trialEndsAt ?? null;

  const updated = await prismaUnscoped.company.update({ where: { id: companyId }, data });
  invalidateCompanyCache(companyId);
  return { from, to, company: updated };
}
