import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const voucher = await prisma.paymentVoucher.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        receivedByName: body.receivedByName || "",
        receivedBySig: body.receivedBySig || "",
      },
    });

    return NextResponse.json(voucher);
  } catch (err: unknown) {
    console.error("POST /api/vouchers/[id]/acknowledge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
