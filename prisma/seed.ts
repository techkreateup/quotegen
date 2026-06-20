import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Multi-tenant SaaS seed: creates the platform Super Admin only.
// Per-company Admin/Employee roles are cloned from src/lib/permissions.ts
// templates at signup time (see /api/auth/signup).
async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@quotegen.local";
  const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.platformRole !== "SUPER_ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { platformRole: "SUPER_ADMIN", companyId: null },
      });
      console.log(`Promoted ${email} to SUPER_ADMIN`);
    } else {
      console.log(`Super admin ${email} already exists`);
    }
  } else {
    await prisma.user.create({
      data: {
        name: "Super Admin",
        email,
        password: bcrypt.hashSync(password, 12),
        platformRole: "SUPER_ADMIN",
        companyId: null,
        isActive: true,
        mustResetPassword: false,
      },
    });
    console.log(`Created super admin: ${email} / ${password === "SuperAdmin@123" ? "SuperAdmin@123 (change this!)" : "(from SUPER_ADMIN_PASSWORD)"}`);
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
