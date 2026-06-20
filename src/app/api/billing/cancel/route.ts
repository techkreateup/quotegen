import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId, getTenantContext } from "@/lib/tenant-context";
import { transitionSubscription, canTransition } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { sendEmail, subscriptionCanceledEmail } from "@/lib/email";

// Cancels the company's subscription. The access stays until the current period
// ends; here we move the state to CANCELED and clear the paid plan. (Period-end
// enforcement / downgrade to FREE is handled by the billing cron.)
async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!canTransition(company.subscriptionStatus, "CANCELED")) {
    return NextResponse.json(
      { error: `Cannot cancel from ${company.subscriptionStatus}` },
      { status: 400 }
    );
  }

  await transitionSubscription(companyId, "CANCELED");

  const settings = await prisma.companySettings.findFirst({ select: { email: true, businessName: true } });
  if (settings?.email) {
    sendEmail({
      to: settings.email,
      subject: "Your QuoteGen subscription was canceled",
      html: subscriptionCanceledEmail(settings.businessName || "there"),
    }).catch(() => {});
  }

  const userId = getTenantContext()?.userId;
  if (userId) {
    logAudit({
      userId,
      entity: "Company",
      entityId: companyId,
      action: "STATUS_CHANGE",
      after: { subscriptionStatus: "CANCELED" },
      ip: clientIp(request),
    });
  }

  return NextResponse.json({ status: "CANCELED" });
}

export const POST = withApi(POST_handler);
