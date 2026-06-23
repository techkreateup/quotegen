// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — ingest (learning plane, write side).
//
// Records one de-identified outcome event when a quotation reaches a TERMINAL
// state (Won / Lost). Design rules:
//   • Resilient: a failure here must NEVER break saving a quote. All work is
//     wrapped and swallowed (logged server-side only).
//   • Consent-aware: skips tenants who have opted out (Company.advisorContributes).
//   • De-identifying: writes only generalized cohort features + a one-way tenant
//     hash. No client name, GSTIN, amount-in-full, user, or company id is stored.
//   • Idempotent-ish: terminal transitions are rare; the caller only invokes this
//     when status actually CHANGES into Won/Lost (see the quotations route).
// ─────────────────────────────────────────────────────────────────────────────

import { prismaUnscoped } from "@/lib/db";
import { tenantHash } from "./privacy";
import { amountBucket, discountBand } from "./cohort";

const TERMINAL = new Set(["Won", "Lost"]);

/** "2026-Q2" for a date — used for seasonality and time-decay. */
function quarterOf(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export interface QuoteOutcomeInput {
  companyId: string;
  status: string; // new status
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  currency: string;
  /** Client industry + state (coarse geography). */
  industry: string;
  region: string;
}

/**
 * Emit a quote-outcome event if the quote is terminal and the tenant contributes.
 * Returns true if an event was written. Never throws.
 */
export async function recordQuoteOutcome(input: QuoteOutcomeInput): Promise<boolean> {
  try {
    if (!TERMINAL.has(input.status)) return false;

    const company = await prismaUnscoped.company.findUnique({
      where: { id: input.companyId },
      select: { advisorContributes: true },
    });
    if (!company?.advisorContributes) return false;

    const discountPct =
      input.subtotal > 0 ? (input.totalDiscount / input.subtotal) * 100 : 0;
    const now = new Date();

    await prismaUnscoped.advisorEvent.create({
      data: {
        tenantHash: tenantHash(input.companyId),
        kind: "quote_outcome",
        industry: (input.industry || "").trim(),
        region: (input.region || "").trim(),
        currency: (input.currency || "INR").toUpperCase(),
        amountBucket: amountBucket(input.totalAmount),
        discountBand: discountBand(discountPct),
        quarter: quarterOf(now),
        won: input.status === "Won",
        occurredAt: now,
      },
    });
    return true;
  } catch (err) {
    // Advisor ingest is best-effort; never surface to the quote-save path.
    console.error("advisor.recordQuoteOutcome failed (non-fatal):", err);
    return false;
  }
}
