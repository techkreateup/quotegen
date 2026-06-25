// Compatibility shim — superseded by platform-brand.ts which also covers brand
// fields. Re-export the GST surface so existing imports keep working.
export {
  GST_RATE_KEY,
  GST_STATE_KEY,
  GST_GSTIN_KEY,
  DEFAULT_GST_RATE,
  DEFAULT_GST_STATE,
  MIN_GST_RATE,
  MAX_GST_RATE,
  isValidGstin,
  clampGstRate,
  getPlatformGst,
  splitGstFromGross as splitGstInclusive,
} from "@/lib/platform-brand";
export type { PlatformGstConfig } from "@/lib/platform-brand";

// DEFAULT_GST_GSTIN kept for historical callers (none today, but cheap).
export const DEFAULT_GST_GSTIN = "";
