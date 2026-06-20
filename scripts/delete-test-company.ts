// One-off: remove a throwaway test company by slug. Usage: npx tsx scripts/delete-test-company.ts <slug>
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const slug = process.argv[2];

async function main() {
  if (!slug) throw new Error("Pass a company slug");
  const company = await prisma.company.findUnique({ where: { slug }, include: { users: true } });
  if (!company) {
    console.log("No company with slug", slug);
    return;
  }
  // Users cascade with the company (companyId FK), but delete explicitly for clarity
  await prisma.company.delete({ where: { slug } });
  console.log(`Deleted company "${company.name}" and ${company.users.length} user(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
