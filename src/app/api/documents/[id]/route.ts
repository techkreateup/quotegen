import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { poolToken } from "@/lib/storage";

const CATEGORIES = new Set([
  "Onboarding", "HR", "Legal", "Finance", "Payroll", "Compliance", "Tax", "Personal", "Other",
]);

// Fetch a single document (tenant-scoped) for the view page.
async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json({ document: doc });
}

// Update document metadata (name, category, description, expiry, entity links).
async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Tenant-safe: scoped findFirst returns the row only if it belongs to this company.
  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 200);
  if (typeof body.category === "string" && CATEGORIES.has(body.category)) data.category = body.category;
  if (typeof body.description === "string") data.description = body.description.slice(0, 500);
  if ("expiresAt" in body) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if ("employeeId" in body) data.employeeId = body.employeeId || null;
  if ("clientId" in body) data.clientId = body.clientId || null;
  if ("projectId" in body) data.projectId = body.projectId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.document.update({ where: { id }, data });
  logAudit({
    userId: request.headers.get("x-user-id") || "system",
    entity: "Document",
    entityId: id,
    action: "UPDATE_DOCUMENT",
  });
  return NextResponse.json({ document: updated });
}

// Delete the document row AND the underlying file from UploadThing.
async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Remove the blob first; if it fails we still drop the row so it can't be
  // re-counted against the quota (orphaned blobs are cleaned by UploadThing TTL).
  if (existing.fileKey) {
    try {
      const token = await poolToken(existing.storagePool);
      await new UTApi(token ? { token } : undefined).deleteFiles([existing.fileKey]);
    } catch (err) {
      console.warn("[documents] UT delete failed:", (err as Error).message);
    }
  }
  await prisma.document.delete({ where: { id } });

  logAudit({
    userId: request.headers.get("x-user-id") || "system",
    entity: "Document",
    entityId: id,
    action: "DELETE_DOCUMENT",
    before: { name: existing.name },
  });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
