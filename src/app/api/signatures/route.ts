import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Org-wide signature library (signing authority — distinct from approval).
// GET returns the saved library PLUS synthesized options from CompanySettings
// sign slots and employee signatures, so a picker has one unified source list.

interface PickerOption {
  id: string;          // "lib:<id>" | "settings:checkedBy" | "employee:<id>"
  signatureId: string | null;
  name: string;
  role: string;
  imageUrl: string;
  source: string;      // library | settings | employee
}

async function GET_handler() {
  const [library, settings, employees] = await Promise.all([
    prisma.signature.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.companySettings.findFirst(),
    prisma.employee.findMany({ where: { signatureUrl: { not: "" } }, select: { id: true, name: true, designation: true, signatureUrl: true } }),
  ]);

  const options: PickerOption[] = [];

  for (const s of library) {
    options.push({ id: `lib:${s.id}`, signatureId: s.id, name: s.name, role: s.role, imageUrl: s.imageUrl, source: "library" });
  }

  if (settings) {
    const slots: { key: string; sig: string; name: string; role: string }[] = [
      { key: "checkedBy", sig: settings.checkedBySig, name: settings.checkedByName, role: settings.checkedByRole },
      { key: "approvedBy", sig: settings.approvedBySig, name: settings.approvedByName, role: settings.approvedByRole },
      { key: "paidBy", sig: settings.paidBySig, name: settings.paidByName, role: settings.paidByRole },
    ];
    for (const sl of slots) {
      if (sl.sig) options.push({ id: `settings:${sl.key}`, signatureId: null, name: sl.name, role: sl.role, imageUrl: sl.sig, source: "settings" });
    }
  }

  for (const e of employees) {
    options.push({ id: `employee:${e.id}`, signatureId: null, name: e.name, role: e.designation, imageUrl: e.signatureUrl, source: "employee" });
  }

  return NextResponse.json({ library, options });
}

// Create a new library signature (role-tagged).
async function POST_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || null;
  const userName = request.headers.get("x-user-name") || "";
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  const role = String(body.role || "").trim().slice(0, 80);
  const imageUrl = String(body.imageUrl || "").trim();
  if (!name || !imageUrl) return NextResponse.json({ error: "name and imageUrl are required" }, { status: 400 });

  const created = await prisma.signature.create({
    data: {
      companyId: request.headers.get("x-company-id") || "",
      name, role, imageUrl,
      source: ["manual", "employee", "settings"].includes(body.source) ? body.source : "manual",
      employeeId: body.employeeId ? String(body.employeeId) : null,
      createdById: userId, createdByName: userName,
    },
  });
  return NextResponse.json({ signature: created }, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
