import { prismaUnscoped } from "@/lib/db";

// Platform-level GST settings for SaaS subscription invoices, editable by
// super admins via /admin/settings. Stored in PlatformSetting as strings.
//
// `rate` is a decimal (e.g. 0.18 for 18%). The provider state determines
// intra-state (CGST+SGST) vs inter-state (IGST) split based on the customer's
// COMPANY state. `gstin` is the SaaS provider's own GST number printed on
// each invoice.

export const GST_RATE_KEY = "platform_gst_rate";
export const GST_STATE_KEY = "platform_gst_state";
export const GST_GSTIN_KEY = "platform_gstin";

export const DEFAULT_GST_RATE = 0.18;
export const DEFAULT_GST_STATE = "Tamil Nadu";
export const DEFAULT_GST_GSTIN = "";

export const MIN_GST_RATE = 0;
export const MAX_GST_RATE = 0.5; // sanity cap — no GST slab is over 50%

const INDIAN_GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface PlatformGstConfig {
  rate: number;
  state: string;
  gstin: string;
}

export function isValidGstin(s: string): boolean {
  return !s || INDIAN_GSTIN_RE.test(s.trim().toUpperCase());
}

export function clampGstRate(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_GST_RATE;
  return Math.min(MAX_GST_RATE, Math.max(MIN_GST_RATE, n));
}

/** Reads all three GST settings in one round trip, with defaults. */
export async function getPlatformGst(): Promise<PlatformGstConfig> {
  try {
    const rows = await prismaUnscoped.platformSetting.findMany({
      where: { key: { in: [GST_RATE_KEY, GST_STATE_KEY, GST_GSTIN_KEY] } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
    const rateRaw = byKey.get(GST_RATE_KEY);
    const rate = rateRaw != null ? clampGstRate(rateRaw) : DEFAULT_GST_RATE;
    const state = byKey.get(GST_STATE_KEY) ?? process.env.PROVIDER_GST_STATE ?? DEFAULT_GST_STATE;
    const gstin = byKey.get(GST_GSTIN_KEY) ?? DEFAULT_GST_GSTIN;
    return { rate, state, gstin };
  } catch {
    return { rate: DEFAULT_GST_RATE, state: DEFAULT_GST_STATE, gstin: DEFAULT_GST_GSTIN };
  }
}

/**
 * Splits a gross (GST-inclusive) amount into the line items printed on a
 * tax invoice. Mirrors the math in subscription-invoice.ts.
 */
export function splitGstInclusive(grossInRupees: number, rate: number) {
  const taxable = Math.round((grossInRupees / (1 + rate)) * 100) / 100;
  const tax = Math.round((grossInRupees - taxable) * 100) / 100;
  return { taxable, tax, gross: grossInRupees };
}
