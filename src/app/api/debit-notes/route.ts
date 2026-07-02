import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { track } from "@/lib/usage";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, debitNoteSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");
    const includeOpts = { items: { orderBy: { sortOrder: "asc" as const } }, vendor: true };
    const orderOpts = { createdAt: "desc" as const };

    const mapRow = (d: { vendor: { name: string }; debitNoteDate: Date; [key: string]: unknown }) => ({
      ...d,
      vendorName: d.vendor.name,
      debitNoteDate: d.debitNoteDate.toISOString().split("T")[0],
    });

    const active = { deletedAt: null };
    if (!pageParam) {
      const rows = await prisma.debitNote.findMany({ where: active, include: includeOpts, orderBy: orderOpts });
      return NextResponse.json(rows.map(mapRow));
    }
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const [rows, total] = await Promise.all([
      prisma.debitNote.findMany({ where: active, include: includeOpts, orderBy: orderOpts, skip: (page - 1) * limit, take: limit }),
      prisma.debitNote.count({ where: active }),
    ]);
    return NextResponse.json({ data: rows.map(mapRow), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    console.error("GET /api/debit-notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(debitNoteSchema, data);
    if (!v.ok) return v.response!;
    const { items, vendorName, ...dnData } = data;

    const companyId = requireCompanyId();
    dnData.debitNoteDate = dnData.debitNoteDate ? new Date(dnData.debitNoteDate) : new Date();
    if (!dnData.purchaseBillId) delete dnData.purchaseBillId;

    const dn = await prisma.$transaction(async (tx) => {
      if (!dnData.debitNoteNo) dnData.debitNoteNo = (await nextDocNumber(tx, "nextDebitNoteNo")).formatted;
      return tx.debitNote.create({
        data: { companyId, ...dnData, items: { create: sanitizeLineItems(items) } },
        include: { items: true },
      });
    });

    const userId = request.headers.get("x-user-id") || "system";
    track("debit_note_created");
    logAudit({ userId, entity: "DebitNote", entityId: dn.id, action: "CREATE", after: { debitNoteNo: dn.debitNoteNo, totalAmount: dn.totalAmount, status: dn.status } });
    return NextResponse.json(dn, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/debit-notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
