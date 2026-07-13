// ─── Branded email shell (Track B / Sprint B6) ───────────────────────────────
// Wraps a message body in a professional, email-client-safe HTML layout. Tables
// + inline styles because Gmail/Outlook strip <style> blocks and ignore
// flex/grid. Pure function (no server deps) so it can also drive a preview.
//
// Logo note: email clients BLOCK `data:` URI images. The caller resolves a
// usable `logoSrc` — a hosted https URL, or a `cid:` reference to an inline
// attachment (see resolveEmailLogo) — and passes it here. When absent we fall
// back to the company name so there's never a broken-image icon.

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

export interface WrapOpts {
  /** Resolved logo src (https URL or cid:...). When set, a logo image is shown. */
  logoSrc?: string;
}

export function wrapBrandedEmail(innerHtml: string, brand: EmailBrand, opts: WrapOpts = {}): string {
  const theme = brand.themeColor || "#4F46E5";
  const name = esc(brand.name || "");
  const logo = opts.logoSrc;

  // Header: a thin colored accent bar, then a clean white band with either the
  // logo or the company name in the brand colour. Logos render well on white.
  const header = logo
    ? `<img src="${esc(logo)}" alt="${name}" style="max-height:46px;max-width:220px;display:block;border:0" />`
    : `<span style="font-size:21px;font-weight:800;letter-spacing:-0.4px;color:${theme}">${name || "&nbsp;"}</span>`;

  const contactLine = [
    brand.email && esc(brand.email),
    brand.phone && esc(brand.phone),
    brand.website && esc(brand.website),
  ].filter(Boolean).join(' &nbsp;<span style="color:#cbd5e1">·</span>&nbsp; ');

  const footerRows = [
    `<div style="font-weight:700;color:#334155;font-size:13px">${name}</div>`,
    brand.address && `<div style="margin-top:3px">${esc(brand.address)}</div>`,
    brand.gstin && `<div style="margin-top:2px">GSTIN: ${esc(brand.gstin)}</div>`,
    contactLine && `<div style="margin-top:6px">${contactLine}</div>`,
  ].filter(Boolean).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/></head>
<body style="margin:0;padding:0;background:#eef2f7;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${name} — message</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.08)">
        <tr><td style="height:5px;background:${theme};line-height:5px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:24px 32px 18px;border-bottom:1px solid #f1f5f9">${header}</td></tr>
        <tr><td style="padding:28px 32px 14px;color:#1e293b;font-size:15px;line-height:1.7">${innerHtml}</td></tr>
        <tr><td style="padding:14px 32px 26px;color:#64748b;font-size:12px;line-height:1.6">${footerRows}</td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="padding:16px 8px 4px;text-align:center;color:#94a3b8;font-size:11px">
          Made with <a href="https://quotegen.kreateup.in" style="color:#4338CA;font-weight:600;text-decoration:none">QuoteGen</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Resolve the email logo. Only hosted http(s) URLs render reliably in email
 * clients, so we use those directly and otherwise fall back to the company name.
 * (data: URIs are converted to a hosted URL upstream in message-context.)
 */
export function resolveEmailLogo(logoUrl?: string): { logoSrc?: string } {
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) return { logoSrc: logoUrl };
  return {};
}
