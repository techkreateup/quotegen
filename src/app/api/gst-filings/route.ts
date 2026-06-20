import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const fy = sp.get("fy"); // e.g. "2025-2026"

    let where = {};
    if (fy) {
      const [startYear] = fy.split("-").map(Number);
      // Indian FY: April of startYear to March of startYear+1
      where = {
        OR: [
          { year: startYear, month: { gte: 4 } },
          { year: startYear + 1, month: { lte: 3 } },
        ],
      };
    }

    const filings = await prisma.gstFiling.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return NextResponse.json(filings);
  } catch (err) {
    console.error("GET /api/gst-filings error:", err);
    return NextResponse.json({ error: "Failed to fetch filings" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const { month, year, returnType, status, filedDate, arnNumber, taxPayable, taxPaid, lateFee, interestAmount, notes } = data;

    const companyId = requireCompanyId();
    const filing = await prisma.gstFiling.upsert({
      where: { companyId_month_year_returnType: { companyId, month, year, returnType } },
      update: {
        status: status || "Pending",
        filedDate: filedDate ? new Date(filedDate) : null,
        arnNumber: arnNumber || "",
        taxPayable: taxPayable || 0,
        taxPaid: taxPaid || 0,
        lateFee: lateFee || 0,
        interestAmount: interestAmount || 0,
        notes: notes || "",
      },
      create: {
        companyId,
        month, year, returnType,
        status: status || "Pending",
        filedDate: filedDate ? new Date(filedDate) : null,
        arnNumber: arnNumber || "",
        taxPayable: taxPayable || 0,
        taxPaid: taxPaid || 0,
        lateFee: lateFee || 0,
        interestAmount: interestAmount || 0,
        notes: notes || "",
      },
    });
    return NextResponse.json(filing);
  } catch (err) {
    console.error("POST /api/gst-filings error:", err);
    return NextResponse.json({ error: "Failed to save filing" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
