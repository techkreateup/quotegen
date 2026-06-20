import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Assignee dropdown source — active platform staff.
async function GET_handler() {
  const staff = await prismaUnscoped.user.findMany({
    where: { platformRole: { in: ["SUPPORT", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true, name: true, platformRole: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ staff });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
