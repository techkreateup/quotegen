import { prismaUnscoped } from "@/lib/db";

// Platform brand/issuer + GST settings — editable by super admin via /admin/settings.
// All stored as PlatformSetting key/value rows so ops can change them without a deploy.
// These values appear on every subscription invoice/receipt PDF.

export const BRAND_NAME_KEY = "platform_brand_name";
export const BRAND_LEGAL_NAME_KEY = "platform_brand_legal_name";
export const BRAND_ADDRESS_KEY = "platform_brand_address";
export const BRAND_EMAIL_KEY = "platform_brand_email";
export const BRAND_PHONE_KEY = "platform_brand_phone";
export const BRAND_WEBSITE_KEY = "platform_brand_website";
export const BRAND_LOGO_URL_KEY = "platform_brand_logo_url";
export const BRAND_POWERED_BY_KEY = "platform_powered_by";

export const GST_RATE_KEY = "platform_gst_rate";
export const GST_STATE_KEY = "platform_gst_state";
export const GST_GSTIN_KEY = "platform_gstin";
export const GST_MODE_KEY = "platform_gst_mode"; // "inclusive" | "exclusive"

export const DEFAULT_GST_RATE = 0.18;
export const DEFAULT_GST_STATE = "Tamil Nadu";
export const DEFAULT_GST_MODE: GstMode = "inclusive";

export const MIN_GST_RATE = 0;
export const MAX_GST_RATE = 0.5;

export type GstMode = "inclusive" | "exclusive";

export const DEFAULT_BRAND = {
  name: "QuoteGen",
  legalName: "Kreateup",
  address: "",
  email: "",
  phone: "",
  website: "https://quotegen.kreateup.in",
  logoUrl: "",
  poweredBy: "Kreateup",
};

const INDIAN_GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface PlatformBrand {
  name: string;
  legalName: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  poweredBy: string;
}

export interface PlatformGstConfig {
  rate: number;
  state: string;
  gstin: string;
  mode: GstMode;
}

export function isValidGstin(s: string): boolean {
  return !s || INDIAN_GSTIN_RE.test(s.trim().toUpperCase());
}

export function clampGstRate(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_GST_RATE;
  return Math.min(MAX_GST_RATE, Math.max(MIN_GST_RATE, n));
}

export function normalizeGstMode(raw: unknown): GstMode {
  return raw === "exclusive" ? "exclusive" : "inclusive";
}

const ALL_KEYS = [
  BRAND_NAME_KEY, BRAND_LEGAL_NAME_KEY, BRAND_ADDRESS_KEY, BRAND_EMAIL_KEY,
  BRAND_PHONE_KEY, BRAND_WEBSITE_KEY, BRAND_LOGO_URL_KEY, BRAND_POWERED_BY_KEY,
  GST_RATE_KEY, GST_STATE_KEY, GST_GSTIN_KEY, GST_MODE_KEY,
];

interface BrandAndGst {
  brand: PlatformBrand;
  gst: PlatformGstConfig;
}

/** One round trip; safe defaults on read failure. */
export async function getPlatformBrandAndGst(): Promise<BrandAndGst> {
  try {
    const rows = await prismaUnscoped.platformSetting.findMany({
      where: { key: { in: ALL_KEYS } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
    const brand: PlatformBrand = {
      name: byKey.get(BRAND_NAME_KEY) ?? DEFAULT_BRAND.name,
      legalName: byKey.get(BRAND_LEGAL_NAME_KEY) ?? DEFAULT_BRAND.legalName,
      address: byKey.get(BRAND_ADDRESS_KEY) ?? DEFAULT_BRAND.address,
      email: byKey.get(BRAND_EMAIL_KEY) ?? DEFAULT_BRAND.email,
      phone: byKey.get(BRAND_PHONE_KEY) ?? DEFAULT_BRAND.phone,
      website: byKey.get(BRAND_WEBSITE_KEY) ?? DEFAULT_BRAND.website,
      logoUrl: byKey.get(BRAND_LOGO_URL_KEY) ?? DEFAULT_BRAND.logoUrl,
      poweredBy: byKey.get(BRAND_POWERED_BY_KEY) ?? DEFAULT_BRAND.poweredBy,
    };
    const rateRaw = byKey.get(GST_RATE_KEY);
    const gst: PlatformGstConfig = {
      rate: rateRaw != null ? clampGstRate(rateRaw) : DEFAULT_GST_RATE,
      state: byKey.get(GST_STATE_KEY) ?? process.env.PROVIDER_GST_STATE ?? DEFAULT_GST_STATE,
      gstin: byKey.get(GST_GSTIN_KEY) ?? "",
      mode: normalizeGstMode(byKey.get(GST_MODE_KEY)),
    };
    return { brand, gst };
  } catch {
    return {
      brand: { ...DEFAULT_BRAND },
      gst: { rate: DEFAULT_GST_RATE, state: DEFAULT_GST_STATE, gstin: "", mode: DEFAULT_GST_MODE },
    };
  }
}

/** Convenience: just GST. Wraps getPlatformBrandAndGst() for old callers. */
export async function getPlatformGst(): Promise<PlatformGstConfig> {
  return (await getPlatformBrandAndGst()).gst;
}

/** Convenience: just brand. */
export async function getPlatformBrand(): Promise<PlatformBrand> {
  return (await getPlatformBrandAndGst()).brand;
}

/**
 * Resolves a captured Razorpay amount + GST mode into the components shown on
 * the invoice. INCLUSIVE: gross IS the captured amount, back out taxable+tax.
 * EXCLUSIVE: gross IS the captured amount but it's already taxable; tax sits
 * on top — except Razorpay has already collected the total, so we MUST treat
 * the gross as the final billed amount and back out using the rate. The only
 * place "mode" changes the math is at PRICE → CHARGE conversion (in checkout
 * + create-order), not after Razorpay captures.
 *
 * On the invoice we always present:
 *   inclusive: gross / (1+rate) = taxable;  tax = gross − taxable
 *   exclusive: taxable = gross / (1+rate);  tax = gross − taxable
 * They produce the same lines because by capture time the gross is final.
 * Mode matters earlier — see priceToCharge() in pricing.ts.
 */
export function splitGstFromGross(grossInRupees: number, rate: number) {
  if (rate <= 0) return { taxable: grossInRupees, tax: 0, gross: grossInRupees };
  const taxable = Math.round((grossInRupees / (1 + rate)) * 100) / 100;
  const tax = Math.round((grossInRupees - taxable) * 100) / 100;
  return { taxable, tax, gross: grossInRupees };
}
