// Post-migration sanity check.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const p = new PrismaClient();

async function main() {
  console.log("companies:", JSON.stringify(await p.company.findMany()));
  console.log(
    "users:",
    JSON.stringify(
      await p.user.findMany({
        select: { email: true, companyId: true, platformRole: true },
      })
    )
  );
  console.log("clients:", await p.client.count());
  console.log("quotations:", await p.quotation.count());
  console.log("invoices:", await p.invoice.count());
  console.log("receipts:", await p.paymentReceipt.count());
  console.log("auditLogs:", await p.auditLog.count());
  const s = await p.companySettings.findFirst();
  console.log("settings companyId:", s?.companyId, "id:", s?.id);
  const unscoped = await p.client.count({ where: { companyId: { not: "cmp_legacy" } } });
  console.log("clients outside legacy company:", unscoped);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
