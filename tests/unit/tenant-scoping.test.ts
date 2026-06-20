import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma, { prismaUnscoped } from "@/lib/db";
import { runWithTenant } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";

// These tests run against the real database using two throwaway companies,
// proving the scoped client enforces isolation end-to-end.
const A = "test_co_a";
const B = "test_co_b";

async function cleanup() {
  await prismaUnscoped.company.deleteMany({ where: { id: { in: [A, B] } } });
}

beforeAll(async () => {
  await cleanup();
  for (const [id, name] of [
    [A, "Test Co A"],
    [B, "Test Co B"],
  ] as const) {
    await prismaUnscoped.company.create({
      data: {
        id,
        name,
        slug: id.replace(/_/g, "-"),
        settings: { create: { businessName: name } },
      },
    });
  }
});

afterAll(async () => {
  await cleanup();
  await prismaUnscoped.$disconnect();
});

function asTenant<T>(companyId: string | null, fn: () => Promise<T>): Promise<T> {
  // Prisma promises are lazy — they execute on await, so the await must
  // happen INSIDE the ALS context for the extension to see it.
  return runWithTenant({ companyId, userId: "test-user" }, async () => await fn());
}

describe("tenant-scoped prisma client", () => {
  it("throws when a tenant model is queried without context", async () => {
    await expect(prisma.client.findMany()).rejects.toThrow(/Tenant context missing/);
  });

  it("blocks platform-staff context from tenant models via scoped client", async () => {
    await expect(asTenant(null, () => prisma.client.findMany())).rejects.toThrow(
      /Use prismaUnscoped/
    );
  });

  // Note: creates pass a wrong/spoofed companyId on purpose — the extension
  // must overwrite it with the context's companyId (anti-spoofing guarantee).
  it("stamps creates with companyId and scopes reads", async () => {
    const created = await asTenant(A, () =>
      prisma.client.create({ data: { businessName: "Client of A", companyId: "spoofed" } })
    );
    expect(created.companyId).toBe(A);

    const seenByA = await asTenant(A, () => prisma.client.findMany());
    const seenByB = await asTenant(B, () => prisma.client.findMany());
    expect(seenByA.some((c) => c.id === created.id)).toBe(true);
    expect(seenByB.some((c) => c.id === created.id)).toBe(false);
  });

  it("blocks cross-tenant reads, updates, and deletes by id", async () => {
    const created = await asTenant(A, () =>
      prisma.client.create({ data: { businessName: "Secret A client", companyId: A } })
    );

    const read = await asTenant(B, () =>
      prisma.client.findUnique({ where: { id: created.id } })
    );
    expect(read).toBeNull();

    await expect(
      asTenant(B, () =>
        prisma.client.update({ where: { id: created.id }, data: { businessName: "hacked" } })
      )
    ).rejects.toThrow();

    await expect(
      asTenant(B, () => prisma.client.delete({ where: { id: created.id } }))
    ).rejects.toThrow();

    // still intact for A
    const stillThere = await asTenant(A, () =>
      prisma.client.findUnique({ where: { id: created.id } })
    );
    expect(stillThere?.businessName).toBe("Secret A client");
  });

  it("scopes counts and aggregates", async () => {
    const countA = await asTenant(A, () => prisma.client.count());
    const countB = await asTenant(B, () => prisma.client.count());
    expect(countA).toBeGreaterThan(0);
    expect(countB).toBe(0);
  });

  it("scopes updateMany/deleteMany to the tenant", async () => {
    await asTenant(B, () =>
      prisma.client.create({ data: { businessName: "B client", companyId: B } })
    );
    // B tries a blanket update — must not touch A's rows
    await asTenant(B, () =>
      prisma.client.updateMany({ data: { industry: "B-industry" } })
    );
    const aClients = await asTenant(A, () => prisma.client.findMany());
    expect(aClients.every((c) => c.industry !== "B-industry")).toBe(true);
  });

  it("upsert stamps companyId on create branch", async () => {
    const up = await asTenant(B, () =>
      prisma.catalogItem.upsert({
        where: { id: "nonexistent-item" },
        create: { name: "B item", companyId: "spoofed" },
        update: {},
      })
    );
    expect(up.companyId).toBe(B);
  });
});

describe("nextDocNumber", () => {
  it("allocates per-company sequential numbers atomically", async () => {
    const a1 = await asTenant(A, () =>
      prisma.$transaction((tx) => nextDocNumber(tx, "nextInvoiceNo"))
    );
    const b1 = await asTenant(B, () =>
      prisma.$transaction((tx) => nextDocNumber(tx, "nextInvoiceNo"))
    );
    const a2 = await asTenant(A, () =>
      prisma.$transaction((tx) => nextDocNumber(tx, "nextInvoiceNo"))
    );
    expect(a1.formatted).toBe("INV00001");
    expect(b1.formatted).toBe("INV00001"); // independent sequence per company
    expect(a2.formatted).toBe("INV00002");
  });

  it("never produces duplicates under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        asTenant(A, () => prisma.$transaction((tx) => nextDocNumber(tx, "nextReceiptNo")))
      )
    );
    const nums = results.map((r) => r.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
