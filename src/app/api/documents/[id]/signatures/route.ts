import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";

// List + add signatures applied to a document. A document may carry many signs
// (template-declared, approval-driven, or manually added here).
async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const signatures = await prisma.documentSignature.findMany({ where: { documentId: id }, orderBy: { appliedAt: "asc" } });
  return NextResponse.json({ signatures });
}

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const imageUrl = String(body.imageUrl || "").trim();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });

  const created = await prisma.documentSignature.create({
    data: {
      companyId: request.headers.get("x-company-id") || "",
      documentId: id,
      signatureId: body.signatureId ? String(body.signatureId) : null,
      signerName: String(body.signerName || "").slice(0, 120),
      signerRole: String(body.signerRole || "").slice(0, 80),
      imageUrl,
      source: "manual",
      appliedById: request.headers.get("x-user-id") || null,
      appliedByName: request.headers.get("x-user-name") || "",
    },
  });
  logAudit({ userId: request.headers.get("x-user-id") || "system", entity: "Document", entityId: id, action: "ADD_SIGNATURE" });
  return NextResponse.json({ signature: created }, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
