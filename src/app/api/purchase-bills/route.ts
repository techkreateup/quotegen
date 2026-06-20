import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const page = parseInt(sp.get("page") || "1");
    const limit = parseInt(sp.get("limit") || "20");
    const month = sp.get("month") ? parseInt(sp.get("month")!) : undefined;
    const year = sp.get("year") ? parseInt(sp.get("year")!) : undefined;

    const where: Record<string, unknown> = {
      status: { not: "Cancelled" },
    };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      where.billDate = { gte: startDate, lte: endDate };
    }

    const [data, total] = await Promise.all([
      prisma.purchaseBill.findMany({
        where,
        include: { vendor: true, items: true },
        orderBy: { billDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseBill.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/purchase-bills error:", err);
    return NextResponse.json({ error: "Failed to fetch purchase bills" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { billNo, billDate, vendorId, description, items, notes, itcEligible } = body;

    // Calculate totals from items
    let subtotal = 0, totalIgst = 0, totalCgst = 0, totalSgst = 0;
    const processedItems = (items || []).map((item: {
      itemName: string; hsnSac?: string; gstRate?: number;
      quantity?: number; rate?: number;
    }) => {
      const qty = item.quantity || 1;
      const rate = item.rate || 0;
      const amount = qty * rate;
      const gstRate = item.gstRate || 0;
      const gstAmount = amount * gstRate / 100;
      // For simplicity: if vendor is in same state, split as CGST+SGST; else IGST
      // We'll default to CGST+SGST (intra-state) â€” user can adjust
      const cgst = gstAmount / 2;
      const sgst = gstAmount / 2;
      const igst = 0;

      subtotal += amount;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      return {
        itemName: item.itemName,
        hsnSac: item.hsnSac || "",
        gstRate,
        quantity: qty,
        rate,
        amount,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total: Math.round((amount + cgst + sgst + igst) * 100) / 100,
      };
    });

    const totalAmount = subtotal + totalIgst + totalCgst + totalSgst;

    const bill = await prisma.purchaseBill.create({
      data: {
        companyId: requireCompanyId(),
        billNo,
        billDate: new Date(billDate),
        vendorId,
        description: description || "",
        subtotal: Math.round(subtotal * 100) / 100,
        totalIgst: Math.round(totalIgst * 100) / 100,
        totalCgst: Math.round(totalCgst * 100) / 100,
        totalSgst: Math.round(totalSgst * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        itcEligible: itcEligible !== false,
        notes: notes || "",
        items: {
          create: processedItems,
        },
      },
      include: { vendor: true, items: true },
    });

    return NextResponse.json(bill);
  } catch (err) {
    console.error("POST /api/purchase-bills error:", err);
    return NextResponse.json({ error: "Failed to create purchase bill" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
