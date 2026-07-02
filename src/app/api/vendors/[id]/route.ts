import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, vendorUpdateSchema } from "@/lib/schemas";

async function GET_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { paidDate: "desc" } },
      },
    });
    if (!vendor)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(vendor);
  } catch (err: unknown) {
    console.error("GET /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function PUT_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(vendorUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.payments;
    delete data.totalPaid;
    delete data.paymentCount;

    const vendor = await prisma.vendor.update({ where: { id }, data });
    return NextResponse.json(vendor);
  } catch (err: unknown) {
    console.error("PUT /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Soft delete into recycle bin. Payments/transactions stay attached.
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
