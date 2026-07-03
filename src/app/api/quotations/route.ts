import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, quotationSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { checkAndTriggerWorkflow } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, client: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapQuotation = (q: { client: { businessName: string }; quotationDate: Date; dueDate: Date | null; [key: string]: unknown }) => ({
      ...q,
      clientName: q.client.businessName,
      quotationDate: q.quotationDate.toISOString().split("T")[0],
      dueDate: q.dueDate?.toISOString().split("T")[0] || "",
    });

    const active = { deletedAt: null };
    if (!pageParam) {
      const quotations = await prisma.quotation.findMany({ where: active, include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(quotations.map(mapQuotation));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({ where: active, include: includeOpts, orderBy: orderOpts, skip, take: limit }),
      prisma.quotation.count({ where: active }),
    ]);

    return NextResponse.json({
      data: quotations.map(mapQuotation),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/quotations error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That quotation number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(quotationSchema, data);
    if (!v.ok) return v.response!;
    const { items, clientName, ...quotationData } = data;

    const companyId = requireCompanyId();
    quotationData.quotationDate = quotationData.quotationDate ? new Date(quotationData.quotationDate) : new Date();
    if (quotationData.dueDate) quotationData.dueDate = new Date(quotationData.dueDate);
    else delete quotationData.dueDate;

    const isProforma = quotationData.docType === "Proforma";
    const quotation = await prisma.$transaction(async (tx) => {
      if (!quotationData.quotationNo) {
        quotationData.quotationNo = (await nextDocNumber(tx, isProforma ? "nextProformaNo" : "nextQuotationNo")).formatted;
      }
      return tx.quotation.create({
        data: {
          companyId,
          ...quotationData,
          items: { create: sanitizeLineItems(items) },
        },
        include: { items: true },
      });
    });
    const userId = request.headers.get("x-user-id") || "system";
    const userRoleId = request.headers.get("x-user-role-id") || "";
    const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";

    if (!isSystemAdmin && userRoleId) {
      const wfResult = await checkAndTriggerWorkflow({
        module: "quotations", trigger: "create",
        entityId: quotation.id, entityType: "quotations",
        userId, userRoleId,
      });
      if (wfResult.triggered) {
        await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "PendingApproval" } });
      }
    }

    track("quotation_created");
    logAudit({ userId, entity: "Quotation", entityId: quotation.id, action: "CREATE", after: { quotationNo: quotation.quotationNo, totalAmount: quotation.totalAmount, status: quotation.status } });
    return NextResponse.json(quotation, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/quotations error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That quotation number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
