// WhatsApp sender via the WhatsApp Cloud API (Meta). Mirrors src/lib/email.ts:
// without WHATSAPP_TOKEN + WHATSAPP_PHONE_ID configured (local/dev), it logs the
// message to the server console instead so flows stay testable.
// Returns true only if a message was actually dispatched.

function normalizePhone(raw: string): string | null {
  // Strip spaces, dashes, parens; keep leading +. Default to India (+91) for
  // 10-digit numbers with no country code.
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned.slice(1);
  if (/^\d{10}$/.test(cleaned)) return `91${cleaned}`;
  if (/^\d{11,15}$/.test(cleaned)) return cleaned;
  return null;
}

export async function sendWhatsApp(opts: { to: string; text: string }): Promise<boolean> {
  const to = normalizePhone(opts.to);
  if (!to) return false;

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.log(`[whatsapp:dev] To: +${to}\n${opts.text}`);
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: opts.text },
      }),
    });
    if (!res.ok) {
      console.error("WhatsApp send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    return false;
  }
}
