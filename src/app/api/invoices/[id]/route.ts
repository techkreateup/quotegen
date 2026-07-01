import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { autoCreateReceipt } from "@/lib/receipt-helper";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, invoiceUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...invoice,
    clientName: invoice.client?.businessName || "",
    invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
    dueDate: invoice.dueDate?.toISOString().split("T")[0] || "",
    paymentDate: invoice.paymentDate?.toISOString().split("T")[0] || "",
    related: await buildLineage("invoice", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(invoiceUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, clientName, client, ...invoiceData } = data;

    delete invoiceData.id;
    delete invoiceData.createdAt;
    delete invoiceData.updatedAt;

    // Clean date fields
    if (invoiceData.invoiceDate) invoiceData.invoiceDate = new Date(invoiceData.invoiceDate);
    else delete invoiceData.invoiceDate;
    if (invoiceData.dueDate) invoiceData.dueDate = new Date(invoiceData.dueDate);
    else if (invoiceData.dueDate === "") invoiceData.dueDate = null;
    else delete invoiceData.dueDate;
    if (invoiceData.paymentDate) invoiceData.paymentDate = new Date(invoiceData.paymentDate);
    else if (invoiceData.paymentDate === "") invoiceData.paymentDate = null;
    else delete invoiceData.paymentDate;
    if (invoiceData.quotationId === "") invoiceData.quotationId = null;
    else if (!invoiceData.quotationId) delete invoiceData.quotationId;

    // If items provided, rebuild line items; otherwise just update metadata/status
    // Get old status to detect Paid transition
    const oldInvoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });

    if (items && Array.isArray(items)) {
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...invoiceData,
          items: { create: sanitizeLineItems(items) },
        },
        include: { items: true },
      });
      const userId = request.headers.get("x-user-id") || "system";
      logAudit({ userId, entity: "Invoice", entityId: id, action: "UPDATE", after: { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount, status: invoice.status } });

      // Auto-create receipt if status changed to Paid
      if (invoice.status === "Paid" && oldInvoice?.status !== "Paid") {
        await autoCreateReceipt(id);
      }

      return NextResponse.json(invoice);
    } else {
      // Simple field update (e.g., status change) — no line item rebuild
      const invoice = await prisma.invoice.update({
        where: { id },
        data: invoiceData,
      });
      const userId = request.headers.get("x-user-id") || "system";
      logAudit({ userId, entity: "Invoice", entityId: id, action: "UPDATE", after: { invoiceNo: invoice.invoiceNo, status: invoice.status } });

      // Auto-create receipt if status changed to Paid
      if (invoice.status === "Paid" && oldInvoice?.status !== "Paid") {
        await autoCreateReceipt(id);
      }

      return NextResponse.json(invoice);
    }
  } catch (err: unknown) {
    console.error("PUT /api/invoices/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const before = await prisma.invoice.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cascade: delete all related records that reference this invoice
    // 1. Transactions linked to this invoice
    await prisma.transaction.deleteMany({ where: { invoiceId: id } });
    // 2. Payment receipts for this invoice
    await prisma.paymentReceipt.deleteMany({ where: { invoiceId: id } });
    // 3. Invoice reminders
    await prisma.invoiceReminder.deleteMany({ where: { invoiceId: id } });
    // 4. Nullify credit note references (credit notes can exist without invoice)
    await prisma.creditNote.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
    // 5. Entity activities & notes
    await prisma.entityActivity.deleteMany({ where: { entityType: "Invoice", entityId: id } }).catch(() => {});
    await prisma.entityNote.deleteMany({ where: { entityType: "Invoice", entityId: id } }).catch(() => {});
    // 6. Line items (should cascade, but be safe)
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

    // Now delete the invoice
    await prisma.invoice.delete({ where: { id } });

    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Invoice", entityId: id, action: "DELETE", before: { invoiceNo: before.invoiceNo, totalAmount: before.totalAmount, status: before.status } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/invoices/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
