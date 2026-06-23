import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

// GET/PUT the tenant's Decision Advisor contribution consent.
// Company is a platform-managed model (not tenant-scoped), so we read/write it
// via prismaUnscoped with an explicit, tenant-locked `where: { id: companyId }`.

async function GET_handler() {
  const companyId = requireCompanyId();
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { advisorContributes: true },
  });
  return NextResponse.json({ advisorContributes: company?.advisorContributes ?? true });
}

async function PUT_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const body = await request.json().catch(() => ({}));
  const advisorContributes = Boolean(body.advisorContributes);
  await prismaUnscoped.company.update({
    where: { id: companyId },
    data: { advisorContributes },
  });
  return NextResponse.json({ ok: true, advisorContributes });
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
