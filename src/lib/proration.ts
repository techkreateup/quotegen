// Sprint 5.1 — mid-cycle proration. Policy: UPGRADES ONLY, credit unused.
// On an upgrade we charge (newPrice − unused credit of the current plan for the
// days remaining in the billing window). Downgrades / same-or-lower price are NOT
// prorated here — they take effect at the next renewal with no refund.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Length of a billing period in days for the plan's billingPeriod. */
export function periodDays(billingPeriod: string): number {
  switch (billingPeriod) {
    case "yearly":
      return 365;
    case "one-time":
      return 0; // no recurring window → no proration
    case "monthly":
    default:
      return 30;
  }
}

/** Compute the end of a billing window starting at `start`. */
export function periodEnd(start: Date, billingPeriod: string): Date {
  return new Date(start.getTime() + periodDays(billingPeriod) * MS_PER_DAY);
}

export interface ProrationInput {
  currentPriceInPaise: number; // price of the plan the company is currently on
  newPriceInPaise: number; // price of the plan being upgraded to
  periodStart: Date | null; // current paid window start (null = no live window)
  periodEnd: Date | null; // current paid window end
  now?: Date;
}

export interface ProrationResult {
  isUpgrade: boolean; // newPrice strictly greater than current → eligible for proration
  creditInPaise: number; // unused value of the current plan (0 when no live window)
  chargeInPaise: number; // amount to actually charge now (clamped ≥ 0)
  remainingDays: number; // whole days left in the current window
}

/**
 * Compute the prorated charge for switching plans.
 *
 * Credit = currentPrice × (remainingDays / totalWindowDays), clamped to the
 * range [0, currentPrice]. Charge = max(0, newPrice − credit).
 *
 * When there's no live billing window (fresh purchase, was on Free, or window
 * already elapsed) the credit is 0 and the full new price is charged.
 */
export function computeProration(input: ProrationInput): ProrationResult {
  const now = input.now ?? new Date();
  const isUpgrade = input.newPriceInPaise > input.currentPriceInPaise;

  let creditInPaise = 0;
  let remainingDays = 0;

  if (
    isUpgrade &&
    input.periodStart &&
    input.periodEnd &&
    input.currentPriceInPaise > 0 &&
    input.periodEnd.getTime() > now.getTime()
  ) {
    const totalMs = input.periodEnd.getTime() - input.periodStart.getTime();
    const remainingMs = input.periodEnd.getTime() - now.getTime();
    if (totalMs > 0) {
      const fraction = Math.min(1, Math.max(0, remainingMs / totalMs));
      creditInPaise = Math.round(input.currentPriceInPaise * fraction);
      creditInPaise = Math.min(creditInPaise, input.currentPriceInPaise);
      remainingDays = Math.max(0, Math.floor(remainingMs / MS_PER_DAY));
    }
  }

  const chargeInPaise = Math.max(0, input.newPriceInPaise - creditInPaise);
  return { isUpgrade, creditInPaise, chargeInPaise, remainingDays };
}
