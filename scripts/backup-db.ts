// One-off safety backup of all tables to JSON before the multi-tenant migration.
// Run: npx tsx scripts/backup-db.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const dump: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  // Prisma exposes lowercase model delegates; iterate over known keys
  const models = Object.keys(prisma).filter(
    (k) => !k.startsWith("$") && !k.startsWith("_")
  );
  for (const m of models) {
    const delegate = (prisma as unknown as Record<string, unknown>)[m] as {
      findMany?: () => Promise<unknown[]>;
    };
    if (typeof delegate?.findMany === "function") {
      dump[m] = await delegate.findMany();
      console.log(`${m}: ${(dump[m] as unknown[]).length} rows`);
    }
  }
  mkdirSync(join(process.cwd(), "backups"), { recursive: true });
  const file = join(
    process.cwd(),
    "backups",
    `pre-tenant-backup-${Date.now()}.json`
  );
  writeFileSync(file, JSON.stringify(dump, null, 2));
  console.log(`\nBackup written to ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
