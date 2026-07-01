import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, salesOrderSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { checkAndTriggerWorkflow } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, client: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapRow = (o: { client: { businessName: string }; orderDate: Date; dueDate: Date | null; clientPoDate: Date | null; [key: string]: unknown }) => ({
      ...o,
      clientName: o.client.businessName,
      orderDate: o.orderDate.toISOString().split("T")[0],
      dueDate: o.dueDate?.toISOString().split("T")[0] || "",
      clientPoDate: o.clientPoDate?.toISOString().split("T")[0] || "",
    });

    if (!pageParam) {
      const rows = await prisma.salesOrder.findMany({ include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(rows.map(mapRow));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.salesOrder.findMany({ include: includeOpts, orderBy: orderOpts, skip, take: limit }),
      prisma.salesOrder.count(),
    ]);

    return NextResponse.json({ data: rows.map(mapRow), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    console.error("GET /api/sales-orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(salesOrderSchema, data);
    if (!v.ok) return v.response!;
    const { items, clientName, ...soData } = data;

    const companyId = requireCompanyId();
    soData.orderDate = soData.orderDate ? new Date(soData.orderDate) : new Date();
    if (soData.dueDate) soData.dueDate = new Date(soData.dueDate); else delete soData.dueDate;
    if (soData.clientPoDate) soData.clientPoDate = new Date(soData.clientPoDate); else delete soData.clientPoDate;
    if (!soData.quotationId) delete soData.quotationId;

    const so = await prisma.$transaction(async (tx) => {
      if (!soData.salesOrderNo) {
        soData.salesOrderNo = (await nextDocNumber(tx, "nextSalesOrderNo")).formatted;
      }
      return tx.salesOrder.create({
        data: { companyId, ...soData, items: { create: sanitizeLineItems(items) } },
        include: { items: true },
      });
    });

    const userId = request.headers.get("x-user-id") || "system";
    const userRoleId = request.headers.get("x-user-role-id") || "";
    const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";
    if (!isSystemAdmin && userRoleId) {
      const wf = await checkAndTriggerWorkflow({ module: "sales-orders", trigger: "create", entityId: so.id, entityType: "sales-orders", userId, userRoleId });
      if (wf.triggered) await prisma.salesOrder.update({ where: { id: so.id }, data: { status: "PendingApproval" } });
    }
    track("sales_order_created");
    logAudit({ userId, entity: "SalesOrder", entityId: so.id, action: "CREATE", after: { salesOrderNo: so.salesOrderNo, totalAmount: so.totalAmount, status: so.status } });
    return NextResponse.json(so, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/sales-orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
