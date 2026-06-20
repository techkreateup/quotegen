import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { invalidateCompanyCache } from "@/lib/with-api";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { clientIp } from "@/lib/rate-limit";

// POST /api/settings/delete-account
// Soft-deletes the company (DPDP): marks it inactive + schedules a hard delete
// after a grace period. Admin-only. The user must confirm by typing the company
// name (passed as { confirm }).
async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const platformRole = request.headers.get("x-platform-role");
  if (platformRole !== "COMPANY_ADMIN" && platformRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a company admin can delete the account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (String(body.confirm || "").trim() !== company.name) {
    return NextResponse.json(
      { error: "Please type the company name exactly to confirm deletion." },
      { status: 400 }
    );
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { isActive: false, deletionRequestedAt: new Date() },
  });
  invalidateCompanyCache(companyId);

  const userId = request.headers.get("x-user-id") || "system";
  logAudit({
    userId,
    entity: "Company",
    entityId: companyId,
    action: "DELETE",
    after: { deletionRequestedAt: new Date().toISOString() },
    ip: clientIp(request),
  });

  // Notify the workspace owner.
  const settings = await prisma.companySettings.findFirst({ select: { email: true } });
  if (settings?.email) {
    sendEmail({
      to: settings.email,
      subject: "Your QuoteGen account is scheduled for deletion",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Account deletion scheduled</h2>
        <p>Your QuoteGen workspace <strong>${company.name}</strong> has been deactivated and is
        scheduled for permanent deletion in 30 days. If this was a mistake, contact support to
        restore it before then.</p>
      </div>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, deletionRequestedAt: new Date().toISOString() });
}

export const POST = withApi(POST_handler);
