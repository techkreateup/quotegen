import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const fy = sp.get("fy");

    let where = {};
    if (fy) {
      const [startYear] = fy.split("-").map(Number);
      where = {
        OR: [
          { year: startYear, month: { gte: 4 } },
          { year: startYear + 1, month: { lte: 3 } },
        ],
      };
    }

    const challans = await prisma.gstChallan.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { challanDate: "desc" }],
    });
    return NextResponse.json(challans);
  } catch (err) {
    console.error("GET /api/gst-challans error:", err);
    return NextResponse.json({ error: "Failed to fetch challans" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const challan = await prisma.gstChallan.create({
      data: {
        companyId: requireCompanyId(),
        challanNo: data.challanNo || "",
        challanDate: new Date(data.challanDate),
        month: data.month,
        year: data.year,
        igst: data.igst || 0,
        cgst: data.cgst || 0,
        sgst: data.sgst || 0,
        cess: data.cess || 0,
        totalAmount: data.totalAmount || 0,
        paymentMode: data.paymentMode || "Net Banking",
        bankName: data.bankName || "",
        cin: data.cin || "",
        status: data.status || "Paid",
        notes: data.notes || "",
      },
    });
    return NextResponse.json(challan);
  } catch (err) {
    console.error("POST /api/gst-challans error:", err);
    return NextResponse.json({ error: "Failed to create challan" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
