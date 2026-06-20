import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { getPendingApprovalsForUser } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pending = await getPendingApprovalsForUser(userId);
    return NextResponse.json({ approvals: pending, total: pending.length });
  } catch {
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
