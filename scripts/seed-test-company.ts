// Seed (or ensure) a reusable TEST company + verified admin for QA across sessions.
// Idempotent — safe to run repeatedly. Run:  npx tsx scripts/seed-test-company.ts
//
//   Login:    dummycopy001@gmail.com  /  TestQuote@2026
//   Company:  "Test Workspace"  (admin is email-verified, ToS accepted, active)
//
// Use this company for live QA instead of touching real tenant data.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { getAdminPermissions, getEmployeePermissions } from "../src/lib/permissions";

const EMAIL = "dummycopy001@gmail.com";
const PASSWORD = "TestQuote@2026";
const COMPANY = "Test Workspace";
const NAME = "Test Admin";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, include: { company: true } });
  if (existing) {
    // Ensure it's a clean, usable login: verified, active, ToS accepted, known password.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashPassword(PASSWORD),
        emailVerified: true,
        isActive: true,
        mustResetPassword: false,
        tosAcceptedAt: existing.tosAcceptedAt ?? new Date(),
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });
    console.log(`✓ Test company already exists — refreshed login.`);
    console.log(`  Company: ${existing.company?.name} (${existing.companyId})`);
    console.log(`  Login:   ${EMAIL} / ${PASSWORD}`);
    return;
  }

  const slugBase = "test-workspace";
  let slug = slugBase;
  for (let i = 2; await prisma.company.findUnique({ where: { slug } }); i++) slug = `${slugBase}-${i}`;

  const result = await prisma.$transaction(async (tx) => {
    let seq = (await tx.company.count()) + 1;
    let code = `CMP-${String(seq).padStart(4, "0")}`;
    while (await tx.company.findUnique({ where: { code } })) code = `CMP-${String(++seq).padStart(4, "0")}`;

    const company = await tx.company.create({
      data: {
        code,
        name: COMPANY,
        slug,
        plan: "Free",
        settings: { create: { businessName: COMPANY, email: EMAIL } },
        onboarding: { create: {} },
      },
    });

    const adminRole = await tx.userRole.create({
      data: { companyId: company.id, name: "Admin", description: "Full access", permissions: getAdminPermissions() as never, isSystem: true },
    });
    await tx.userRole.create({
      data: { companyId: company.id, name: "Employee", description: "Sales access", permissions: getEmployeePermissions() as never, isSystem: true },
    });

    const user = await tx.user.create({
      data: {
        name: NAME,
        email: EMAIL,
        password: hashPassword(PASSWORD),
        companyId: company.id,
        platformRole: "COMPANY_ADMIN",
        roleId: adminRole.id,
        isActive: true,
        mustResetPassword: false,
        emailVerified: true,
        tosAcceptedAt: new Date(),
      },
    });
    return { company, user };
  });

  console.log(`✓ Created test company.`);
  console.log(`  Company: ${result.company.name} (${result.company.id})`);
  console.log(`  Login:   ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
