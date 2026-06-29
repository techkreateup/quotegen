// ─── Merge-field rendering (client-safe) ─────────────────────────────────────
// Pure template helpers with NO server-only imports, so both the server
// (messaging.ts) and client components (template editor live preview) can use
// them. Dispatch + MessageLog live in messaging.ts.

import { formatCurrency } from "@/lib/currency";

export type Channel = "EMAIL" | "WHATSAPP";
export type MergeContext = Record<string, unknown>;

/** Escape a value for safe interpolation into an HTML body (XSS rule, LEARNING §6). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resolve a dotted path (`client.email`, `invoice.total`) against the context. */
function lookup(ctx: MergeContext, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, ctx);
}

/** Format a resolved merge value to a display string; money-looking numeric keys
 *  render via formatCurrency using the context's `currency` (default INR). */
function formatValue(path: string, value: unknown, ctx: MergeContext): string {
  if (value == null) return "";
  if (typeof value === "number") {
    const moneyish = /amount|total|balance|due|paid|subtotal|price|grand/i.test(path);
    if (moneyish) {
      const currency = (lookup(ctx, "currency") as string) || "INR";
      return formatCurrency(value, currency);
    }
    return String(value);
  }
  if (value instanceof Date) return value.toLocaleDateString("en-IN");
  return String(value);
}

const MERGE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Render a template string, substituting `{{path}}` tokens from `ctx`.
 * `escape: true` (default for HTML bodies/subjects) HTML-escapes each value so
 * user-controlled fields can't inject markup. Unknown tokens render as "".
 */
export function renderTemplate(
  tpl: string,
  ctx: MergeContext,
  opts: { escape?: boolean } = {}
): string {
  const escape = opts.escape ?? true;
  return (tpl || "").replace(MERGE_RE, (_m, path: string) => {
    const raw = formatValue(path, lookup(ctx, path), ctx);
    return escape ? escapeHtml(raw) : raw;
  });
}

/** List the merge keys referenced by a template (for the editor's var picker). */
export function extractMergeKeys(tpl: string): string[] {
  const keys = new Set<string>();
  for (const m of (tpl || "").matchAll(MERGE_RE)) keys.add(m[1]);
  return [...keys];
}

/**
 * Resolve a recipient expression to a list of addresses/numbers. Supports a
 * literal ("a@b.com, c@d.com"), merge tokens ("{{client.email}}"), or a mix.
 * Recipients are split on comma/semicolon/whitespace; blanks dropped.
 */
export function resolveRecipients(expr: string, ctx: MergeContext): string[] {
  if (!expr) return [];
  const rendered = renderTemplate(expr, ctx, { escape: false });
  return rendered
    .split(/[,;\s]+/)
    .map((r) => r.trim())
    .filter(Boolean);
}

/** Crude HTML→text for WhatsApp/plain channels: drop tags, decode a few entities. */
export function htmlToText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
