import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { threeWayMatch } from "@/lib/three-way-match";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const report = await threeWayMatch(id);
    return NextResponse.json(report);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Purchase order not found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("GET /api/purchase-orders/[id]/reconcile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
