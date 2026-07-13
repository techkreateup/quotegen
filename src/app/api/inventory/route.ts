import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { getStockLevels } from "@/lib/stock";
import { logAudit } from "@/lib/audit";

// GET → stock levels for all tracked items (+ recent movements for one item
// via ?itemId=). POST → manual adjustment { catalogItemId, qty, note } where
// qty is signed (+ receive / − issue).
async function GET_handler(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("itemId");
    if (itemId) {
      const movements = await prisma.stockMovement.findMany({
        where: { catalogItemId: itemId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return NextResponse.json(movements);
    }
    const levels = await getStockLevels(prisma);
    return NextResponse.json(levels);
  } catch (err) {
    console.error("GET /api/inventory error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const { catalogItemId, qty, note } = await request.json();
    const q = Number(qty);
    if (!catalogItemId || !Number.isFinite(q) || q === 0) {
      return NextResponse.json({ error: "catalogItemId and a non-zero qty are required" }, { status: 400 });
    }
    const companyId = requireCompanyId();
    const item = await prisma.catalogItem.findFirst({ where: { id: catalogItemId }, select: { id: true, name: true } });
    if (!item) return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });

    const userId = request.headers.get("x-user-id") || "system";
    const mv = await prisma.stockMovement.create({
      data: {
        companyId, catalogItemId, qty: q, kind: "adjustment",
        note: String(note ?? "").slice(0, 500), createdById: userId,
      },
    });
    logAudit({ userId, entity: "StockMovement", entityId: mv.id, action: "CREATE", after: { item: item.name, qty: q, kind: "adjustment" } });
    return NextResponse.json(mv, { status: 201 });
  } catch (err) {
    console.error("POST /api/inventory error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
