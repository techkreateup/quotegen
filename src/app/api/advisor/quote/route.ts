import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma, { prismaUnscoped } from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { hasCompanyFeature } from "@/lib/feature-gate";
import {
  ancestorCohortKeys,
  statKey,
  toCohortFeatures,
  type DealFeatures,
} from "@/lib/advisor/cohort";
import { adviseQuote } from "@/lib/advisor/recommend";
import type { StatRow } from "@/lib/advisor/backoff";

const KIND = "quote_outcome";

// POST /api/advisor/quote
// Body: { quotationId?, clientId?, subtotal, totalDiscount, totalAmount, currency }
// Returns win-probability advice for the draft quote. Reads the tenant's own
// client (scoped) for cohort features and the GLOBAL, already-anonymized cohort
// stats (unscoped — they hold no tenant data). Never another tenant's rows.
async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();

  // Premium/beta feature gate (default-on for existing tenants).
  if (!(await hasCompanyFeature(companyId, "decision-advisor"))) {
    return NextResponse.json({ status: "off" });
  }

  const body = await request.json().catch(() => ({}));
  const subtotal = Number(body.subtotal) || 0;
  const totalDiscount = Number(body.totalDiscount) || 0;
  const totalAmount = Number(body.totalAmount) || 0;
  const currency = String(body.currency || "INR");

  // Cohort features come from the client's industry + state (coarse geography).
  let industry = "";
  let region = "";
  if (body.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: String(body.clientId) },
      select: { industry: true, state: true },
    });
    industry = client?.industry ?? "";
    region = client?.state ?? "";
  }

  const deal: DealFeatures = {
    industry,
    region,
    currency,
    amount: totalAmount,
    discountPct: subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0,
  };

  // Load the published stats for this deal's ancestor cohorts (all bands).
  const features = toCohortFeatures(deal);
  const cohortKeys = ancestorCohortKeys(features).map((a) => a.key);
  const rows = await prismaUnscoped.advisorCohortStat.findMany({
    where: { kind: KIND, cohortKey: { in: cohortKeys } },
    select: { cohortKey: true, discountBand: true, wins: true, trials: true, tenantCount: true },
  });

  const byStatKey = new Map<string, StatRow>();
  for (const r of rows) {
    byStatKey.set(statKey(r.cohortKey, r.discountBand), {
      wins: r.wins,
      trials: r.trials,
      tenantCount: r.tenantCount,
    });
  }

  const advice = adviseQuote(deal, (k) => byStatKey.get(k) ?? null);

  // Cache for the learning loop (Phase 3.5 bandit). Best-effort.
  if (body.quotationId) {
    try {
      const subjectId = String(body.quotationId);
      await prisma.advisorRecommendation.deleteMany({ where: { subjectId, kind: "quote_winprob" } });
      await prisma.advisorRecommendation.create({
        data: {
          companyId,
          kind: "quote_winprob",
          subjectId,
          payload: advice as unknown as Prisma.InputJsonValue,
          shownAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
    } catch {
      /* caching is non-essential */
    }
  }

  return NextResponse.json(advice);
}

export const POST = withApi(POST_handler);
