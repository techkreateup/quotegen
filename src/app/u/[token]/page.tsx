import { prismaUnscoped } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import Link from "next/link";
import { MailX, CheckCircle2, AlertTriangle } from "lucide-react";

// Public unsubscribe landing (DPDP compliance). Flips Client.doNotContact = true
// for the token's client + records the change. No auth required — the token
// itself is the credential, so it must be time-safe verified against the
// UNSUBSCRIBE_SECRET / JWT_SECRET.

export const dynamic = "force-dynamic";

async function processToken(token: string): Promise<{ ok: boolean; companyName: string; clientName: string; error?: string }> {
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return { ok: false, companyName: "", clientName: "", error: "This link is invalid or expired." };

  const client = await prismaUnscoped.client.findFirst({
    where: { id: parsed.clientId, companyId: parsed.companyId },
    select: { id: true, businessName: true, doNotContact: true, company: { select: { name: true } } },
  });
  if (!client) return { ok: false, companyName: "", clientName: "", error: "We couldn't find that record." };

  if (!client.doNotContact) {
    await prismaUnscoped.client.update({
      where: { id: client.id },
      data: { doNotContact: true },
    });
  }
  return { ok: true, companyName: client.company?.name ?? "the sender", clientName: client.businessName };
}

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await processToken(token);

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F8", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 460, background: "white", borderRadius: 16, padding: 32, boxShadow: "0 20px 60px rgba(15,23,42,0.10)", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: result.ok ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#EF4444,#B91C1C)" }}>
          {result.ok ? <CheckCircle2 size={26} color="white" /> : <AlertTriangle size={26} color="white" />}
        </div>
        {result.ok ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>You&apos;ve been unsubscribed</h1>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 20 }}>
              {result.companyName} will no longer send automated invoice reminders or follow-ups to <b>{result.clientName}</b>.
              Transactional documents (invoices you request, receipts for payments) may still be sent as required by law.
            </p>
            <p style={{ fontSize: 12, color: "#94A3B8" }}>
              Changed your mind? Reply to any recent email from {result.companyName} to be re-added.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Link not valid</h1>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.5 }}>{result.error}</p>
          </>
        )}
        <div style={{ marginTop: 24, borderTop: "1px solid #E5E7EB", paddingTop: 16, fontSize: 11.5, color: "#94A3B8" }}>
          Powered by <Link href="/" style={{ color: "#6366F1", fontWeight: 600 }}>QuoteGen</Link><MailX size={12} style={{ display: "inline", marginLeft: 6, verticalAlign: "-2px" }} />
        </div>
      </div>
    </div>
  );
}
