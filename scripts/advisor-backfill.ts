// Decision Advisor — one-time backfill.
//
// Replays existing terminal (Won/Lost) quotations into the de-identified
// AdvisorEvent log so the learning engine has history to aggregate from day one.
// Respects per-tenant consent (Company.advisorContributes) and writes ONLY
// generalized cohort features + a one-way tenant hash — exactly like live ingest.
//
//   npx tsx scripts/advisor-backfill.ts          (dry run — counts only)
//   npx tsx scripts/advisor-backfill.ts --write   (actually insert events)
import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const WRITE = process.argv.includes("--write");

const SALT = process.env.ADVISOR_SALT || process.env.JWT_SECRET || "dev-only-advisor-salt";
const tenantHash = (companyId: string) =>
  crypto.createHmac("sha256", SALT).update(companyId).digest("hex");

const AMOUNT: [number, string][] = [
  [10_000, "<10k"], [50_000, "10k-50k"], [100_000, "50k-1L"],
  [500_000, "1L-5L"], [1_000_000, "5L-10L"], [5_000_000, "10L-50L"],
];
const amountBucket = (a: number) => AMOUNT.find(([c]) => (a || 0) < c)?.[1] ?? "50L+";

const discountBand = (pct: number) => {
  const v = Math.max(0, pct || 0);
  if (v <= 0.0001) return "0%";
  if (v <= 5) return "0-5%";
  if (v <= 10) return "5-10%";
  if (v <= 15) return "10-15%";
  if (v <= 20) return "15-20%";
  if (v <= 30) return "20-30%";
  return "30%+";
};
const quarterOf = (d: Date) => `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;

async function main() {
  const opted = await p.company.findMany({
    where: { advisorContributes: true },
    select: { id: true },
  });
  const optedIn = new Set(opted.map((c) => c.id));

  const quotes = await p.quotation.findMany({
    where: { status: { in: ["Won", "Lost"] } },
    select: {
      companyId: true, status: true, subtotal: true, totalDiscount: true,
      totalAmount: true, currency: true, updatedAt: true,
      client: { select: { industry: true, state: true } },
    },
  });

  const rows = quotes
    .filter((q) => optedIn.has(q.companyId))
    .map((q) => {
      const discountPct = q.subtotal > 0 ? (q.totalDiscount / q.subtotal) * 100 : 0;
      return {
        tenantHash: tenantHash(q.companyId),
        kind: "quote_outcome",
        industry: (q.client?.industry ?? "").trim(),
        region: (q.client?.state ?? "").trim(),
        currency: (q.currency || "INR").toUpperCase(),
        amountBucket: amountBucket(q.totalAmount),
        discountBand: discountBand(discountPct),
        quarter: quarterOf(q.updatedAt),
        won: q.status === "Won",
        occurredAt: q.updatedAt,
      };
    });

  console.log(`terminal quotes: ${quotes.length}, eligible (opted-in): ${rows.length}`);
  if (!WRITE) {
    console.log("dry run — pass --write to insert. Sample:", rows.slice(0, 3));
    return;
  }
  const res = await p.advisorEvent.createMany({ data: rows });
  console.log(`inserted ${res.count} advisor events.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
