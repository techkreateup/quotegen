import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parse, clientUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(clientUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.quotations;
    delete data.invoices;
    delete data.receipts;
    delete data.projects;

    const before = await prisma.client.findUnique({ where: { id } });
    const client = await prisma.client.update({ where: { id }, data });
    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Client", entityId: id, action: "UPDATE", before: before ? { businessName: before.businessName, status: before.status } : null, after: { businessName: client.businessName, status: client.status } });
    return NextResponse.json(client);
  } catch (err: unknown) {
    console.error("PUT /api/clients/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const before = await prisma.client.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check if client has invoices, quotations, etc.
    const [invoiceCount, quotationCount] = await Promise.all([
      prisma.invoice.count({ where: { clientId: id } }),
      prisma.quotation.count({ where: { clientId: id } }),
    ]);

    if (invoiceCount > 0 || quotationCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete client with ${invoiceCount} invoice(s) and ${quotationCount} quotation(s). Delete or reassign them first.` },
        { status: 400 }
      );
    }

    // Safe cascade for non-critical linked data
    await prisma.recurringInvoice.deleteMany({ where: { clientId: id } });
    await prisma.creditNote.updateMany({ where: { clientId: id }, data: {} }); // credit notes have required clientId — block handled above via invoices
    await prisma.paymentReceipt.deleteMany({ where: { clientId: id } });
    await prisma.entityActivity.deleteMany({ where: { entityType: "Client", entityId: id } }).catch(() => {});
    await prisma.entityNote.deleteMany({ where: { entityType: "Client", entityId: id } }).catch(() => {});

    await prisma.client.delete({ where: { id } });

    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Client", entityId: id, action: "DELETE", before: { businessName: before.businessName } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/clients/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
