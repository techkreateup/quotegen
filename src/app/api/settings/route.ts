import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler() {
  const companyId = requireCompanyId();
  let settings = await prisma.companySettings.findUnique({ where: { companyId } });
  if (!settings) {
    settings = await prisma.companySettings.create({ data: { companyId } });
  }
  return NextResponse.json(settings);
}

async function PUT_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const data = await request.json();
  delete data.id;
  delete data.companyId;
  const settings = await prisma.companySettings.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...data },
  });
  return NextResponse.json(settings);
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
