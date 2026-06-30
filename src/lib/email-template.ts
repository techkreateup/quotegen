// ─── Branded email shell (Track B / Sprint B6) ───────────────────────────────
// Wraps a message body (the editable template content) in a professional,
// email-client-safe HTML layout: branded header, white content card, and a
// footer with the company's real details. Table-based + inline styles because
// Gmail/Outlook strip <style> blocks and ignore fl/grid. Pure function — no
// server deps — so it can also drive the editor's branded preview.

export interface EmailBrand {
  name: string;
  logoUrl?: string;
  address?: string;
  gstin?: string;
  email?: string;
  phone?: string;
  website?: string;
  themeColor?: string;
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Wrap inner body HTML in the branded shell. `innerHtml` is already-rendered
 * (merge fields resolved). Keep it idempotent-friendly: callers pass the raw
 * message body, we add chrome around it.
 */
export function wrapBrandedEmail(innerHtml: string, brand: EmailBrand): string {
  const theme = brand.themeColor || "#4F46E5";
  const name = esc(brand.name || "");
  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${name}" height="40" style="max-height:40px;display:block" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${name || "&nbsp;"}</span>`;

  const footerBits = [
    brand.address && esc(brand.address),
    brand.gstin && `GSTIN: ${esc(brand.gstin)}`,
    [brand.email && esc(brand.email), brand.phone && esc(brand.phone), brand.website && esc(brand.website)]
      .filter(Boolean).join(" &nbsp;·&nbsp; "),
  ].filter(Boolean).join("<br/>");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <!-- header -->
        <tr><td style="background:${theme};padding:22px 28px">${header}</td></tr>
        <!-- body -->
        <tr><td style="padding:28px 28px 8px;color:#1e293b;font-size:14.5px;line-height:1.65">${innerHtml}</td></tr>
        <!-- divider -->
        <tr><td style="padding:8px 28px"><div style="height:1px;background:#e2e8f0"></div></td></tr>
        <!-- footer -->
        <tr><td style="padding:16px 28px 26px;color:#64748b;font-size:12px;line-height:1.6">
          <strong style="color:#334155">${name}</strong><br/>${footerBits}
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:14px 0 0">Powered by QuoteGen</p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Turn a bare "View here: https://…" style link in the body into nothing special —
 * the body templates already carry links. This helper exists for callers that
 * want to append a CTA button. Optional.
 */
export function ctaButton(url: string, label: string, themeColor = "#4F46E5"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="background:${themeColor};border-radius:8px"><a href="${url}" style="display:inline-block;padding:11px 22px;color:#fff;font-weight:600;font-size:14px;text-decoration:none">${label}</a></td></tr></table>`;
}
