import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, invoiceSchema } from "@/lib/schemas";
import { track } from "@/lib/usage";
import { logAudit } from "@/lib/audit";
import { autoCreateReceipt } from "@/lib/receipt-helper";
import { checkAndTriggerWorkflow } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    // Auto-detect overdue invoices: mark Unpaid invoices past due date as Overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.invoice.updateMany({
      where: {
        status: "Unpaid",
        dueDate: { lt: today },
      },
      data: { status: "Overdue" },
    });

    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, client: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapInvoice = (inv: { client: { businessName: string }; invoiceDate: Date; dueDate: Date | null; paymentDate: Date | null; [key: string]: unknown }) => ({
      ...inv,
      clientName: inv.client.businessName,
      invoiceDate: inv.invoiceDate.toISOString().split("T")[0],
      dueDate: inv.dueDate?.toISOString().split("T")[0] || "",
      paymentDate: inv.paymentDate?.toISOString().split("T")[0] || "",
    });

    const active = { deletedAt: null };
    if (!pageParam) {
      const invoices = await prisma.invoice.findMany({
        where: active, include: includeOpts, orderBy: orderOpts,
      });
      return NextResponse.json(invoices.map(mapInvoice));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where: active, include: includeOpts, orderBy: orderOpts, skip, take: limit }),
      prisma.invoice.count({ where: active }),
    ]);

    return NextResponse.json({
      data: invoices.map(mapInvoice),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/invoices error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(invoiceSchema, data);
    if (!v.ok) return v.response!;
    const { items, clientName, ...invoiceData } = data;

    const companyId = requireCompanyId();
    invoiceData.invoiceDate = invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date();
    if (invoiceData.dueDate) invoiceData.dueDate = new Date(invoiceData.dueDate);
    else delete invoiceData.dueDate;
    if (invoiceData.paymentDate) invoiceData.paymentDate = new Date(invoiceData.paymentDate);
    else delete invoiceData.paymentDate;
    if (!invoiceData.quotationId) delete invoiceData.quotationId;

    const invoice = await prisma.$transaction(async (tx) => {
      if (!invoiceData.invoiceNo) {
        // Pick the numbering series. When the company keeps GST and non-GST
        // invoices in separate series, an invoice for a client WITHOUT a GSTIN
        // uses the non-GST series. GST status is auto-detected from the client's
        // GSTIN (entered on the client/quote) — no manual choice needed.
        let counter: "nextInvoiceNo" | "nextNonGstInvoiceNo" = "nextInvoiceNo";
        const cfg = await tx.companySettings.findUnique({ where: { companyId }, select: { separateGstInvoices: true } });
        if (cfg?.separateGstInvoices) {
          const cl = await tx.client.findUnique({ where: { id: invoiceData.clientId }, select: { gstin: true } });
          if (!cl?.gstin?.trim()) counter = "nextNonGstInvoiceNo";
        }
        invoiceData.invoiceNo = (await nextDocNumber(tx, counter)).formatted;
      }
      return tx.invoice.create({
        data: {
          companyId,
          ...invoiceData,
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
        module: "invoices", trigger: "create",
        entityId: invoice.id, entityType: "invoices",
        userId, userRoleId,
      });
      if (wfResult.triggered) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PendingApproval" } });
      }
    }

    track("invoice_created");
    logAudit({ userId, entity: "Invoice", entityId: invoice.id, action: "CREATE", after: { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount, status: invoice.status } });

    // Auto-create payment receipt if invoice is created with Paid status
    if (invoice.status === "Paid") {
      await autoCreateReceipt(invoice.id);
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/invoices error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That invoice number is already in use. Pick another." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
