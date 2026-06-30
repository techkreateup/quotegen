import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";
import {
  defaultCycleConfig,
  parseCycleConfig,
  enabledModules,
  type BusinessProfile,
  type CycleConfig,
} from "@/lib/cycle-config";

const BUSINESS_TYPES = ["service", "trading", "manufacturing", "mixed"];
const TEAM_SIZES = ["solo", "small", "medium", "large"];

// Returns the company's business profile + cycle config, plus the set of enabled
// permission-modules (so the client can gate the sidebar without re-deriving it).
async function GET_handler() {
  try {
    const s = await prisma.companySettings.findFirst({
      select: {
        businessType: true, sellsGoods: true, buysStock: true,
        hasEmployees: true, teamSize: true, setupCompleted: true, cycleConfig: true,
        separateGstInvoices: true,
      },
    });
    const cycleConfig = parseCycleConfig(s?.cycleConfig);
    return NextResponse.json({
      profile: {
        businessType: s?.businessType ?? "service",
        sellsGoods: s?.sellsGoods ?? false,
        buysStock: s?.buysStock ?? false,
        hasEmployees: s?.hasEmployees ?? false,
        teamSize: s?.teamSize ?? "solo",
        separateGstInvoices: s?.separateGstInvoices ?? false,
      },
      setupCompleted: s?.setupCompleted ?? false,
      cycleConfig,
      enabledModules: [...enabledModules(cycleConfig)],
    });
  } catch {
    return NextResponse.json({ error: "Failed to load setup" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const profile: BusinessProfile = {
      businessType: BUSINESS_TYPES.includes(String(body.businessType)) ? (body.businessType as BusinessProfile["businessType"]) : "service",
      sellsGoods: !!body.sellsGoods,
      buysStock: !!body.buysStock,
      hasEmployees: !!body.hasEmployees,
      teamSize: TEAM_SIZES.includes(String(body.teamSize)) ? (body.teamSize as BusinessProfile["teamSize"]) : "solo",
    };

    // The wizard sends a profile → we compute defaults. The per-stage editor (E2)
    // may send an explicit cycleConfig → honour it.
    const cycleConfig: CycleConfig = body.cycleConfig
      ? parseCycleConfig(body.cycleConfig)
      : defaultCycleConfig(profile);

    const separateGstInvoices = !!body.separateGstInvoices;
    const companyId = requireCompanyId();
    await prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, ...profile, separateGstInvoices, cycleConfig: cycleConfig as object, setupCompleted: true },
      update: { ...profile, separateGstInvoices, cycleConfig: cycleConfig as object, setupCompleted: true },
    });

    logAudit({
      userId, entity: "CompanySettings", entityId: companyId, action: "UPDATE",
      after: { businessSetup: profile },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ ok: true, cycleConfig, enabledModules: [...enabledModules(cycleConfig)] });
  } catch {
    return NextResponse.json({ error: "Failed to save setup" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
