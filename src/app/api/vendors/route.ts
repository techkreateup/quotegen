import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, vendorSchema } from "@/lib/schemas";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const includeOpts = {
      _count: { select: { payments: true } },
      payments: { select: { amount: true } },
    };

    const mapVendor = (v: { payments: { amount: number }[]; _count: { payments: number }; [key: string]: unknown }) => {
      const totalPaid = v.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const { payments, _count, ...rest } = v;
      return { ...rest, totalPaid, paymentCount: _count.payments };
    };

    const active = { deletedAt: null };
    if (!pageParam) {
      const vendors = await prisma.vendor.findMany({
        where: active, orderBy: { createdAt: "desc" }, include: includeOpts,
      });
      return NextResponse.json(vendors.map(mapVendor));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({ where: active, orderBy: { createdAt: "desc" }, include: includeOpts, skip, take: limit }),
      prisma.vendor.count({ where: active }),
    ]);

    return NextResponse.json({
      data: vendors.map(mapVendor),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/vendors error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(vendorSchema, data);
    if (!v.ok) return v.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.payments;

    const vendor = await prisma.vendor.create({ data });
    return NextResponse.json(vendor, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/vendors error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
