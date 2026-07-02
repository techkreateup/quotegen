import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { nextDocNumber } from "@/lib/numbering";

// C1 — assign an employeeCode to any employee missing one (or with a manually-
// entered value that doesn't match the standard EMP##### shape). Idempotent: runs
// through the shared numbering counter so codes stay unique and gap-free after.

async function POST_handler(_req: NextRequest) {
  const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
  const missing = employees.filter(e => !e.employeeCode || !/^EMP\d{4,}$/.test(e.employeeCode));

  let updated = 0;
  for (const emp of missing) {
    try {
      await prisma.$transaction(async (tx) => {
        const { number } = await nextDocNumber(tx, "nextEmployeeNo");
        await tx.employee.update({ where: { id: emp.id }, data: { employeeCode: `EMP${String(number).padStart(5, "0")}` } });
      });
      updated++;
    } catch (err) {
      console.error("[backfill-codes] failed for", emp.id, err);
    }
  }
  return NextResponse.json({ scanned: employees.length, updated });
}

export const POST = withApi(POST_handler);
