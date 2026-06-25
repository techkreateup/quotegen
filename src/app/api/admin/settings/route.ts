import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  AUDIT_RETENTION_KEY, MIN_AUDIT_RETENTION_DAYS, MAX_AUDIT_RETENTION_DAYS,
  USAGE_RETENTION_KEY, MIN_USAGE_RETENTION_DAYS,
  normalizeRetentionDays, DEFAULT_AUDIT_RETENTION_DAYS, DEFAULT_USAGE_RETENTION_DAYS,
} from "@/lib/retention";
import {
  GST_RATE_KEY, GST_STATE_KEY, GST_GSTIN_KEY, GST_MODE_KEY,
  MIN_GST_RATE, MAX_GST_RATE, clampGstRate, isValidGstin, normalizeGstMode,
  BRAND_NAME_KEY, BRAND_LEGAL_NAME_KEY, BRAND_ADDRESS_KEY, BRAND_EMAIL_KEY,
  BRAND_PHONE_KEY, BRAND_WEBSITE_KEY, BRAND_LOGO_URL_KEY, BRAND_POWERED_BY_KEY,
} from "@/lib/platform-brand";

// Platform-wide key/value settings (super-admin only; gated by proxy).
// GET → { [key]: value }   PUT { key, value } → upsert.
//
// Only known keys are writable, and retention windows are validated/clamped to
// safe ranges so a stray value can't trigger a near-total data wipe.
const ALLOWED_KEYS = new Set([
  AUDIT_RETENTION_KEY, USAGE_RETENTION_KEY,
  GST_RATE_KEY, GST_STATE_KEY, GST_GSTIN_KEY, GST_MODE_KEY,
  BRAND_NAME_KEY, BRAND_LEGAL_NAME_KEY, BRAND_ADDRESS_KEY, BRAND_EMAIL_KEY,
  BRAND_PHONE_KEY, BRAND_WEBSITE_KEY, BRAND_LOGO_URL_KEY, BRAND_POWERED_BY_KEY,
]);

const BRAND_TEXT_KEYS = new Set<string>([
  BRAND_NAME_KEY, BRAND_LEGAL_NAME_KEY, BRAND_EMAIL_KEY, BRAND_PHONE_KEY,
  BRAND_WEBSITE_KEY, BRAND_LOGO_URL_KEY, BRAND_POWERED_BY_KEY,
]);

function validateValue(key: string, value: string): { value: string } | { error: string } {
  if (key === AUDIT_RETENTION_KEY) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < MIN_AUDIT_RETENTION_DAYS || n > MAX_AUDIT_RETENTION_DAYS) {
      return { error: `audit_retention_days must be between ${MIN_AUDIT_RETENTION_DAYS} and ${MAX_AUDIT_RETENTION_DAYS}` };
    }
    return { value: String(normalizeRetentionDays(n, DEFAULT_AUDIT_RETENTION_DAYS, MIN_AUDIT_RETENTION_DAYS)) };
  }
  if (key === USAGE_RETENTION_KEY) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < MIN_USAGE_RETENTION_DAYS) {
      return { error: `usage_retention_days must be at least ${MIN_USAGE_RETENTION_DAYS}` };
    }
    return { value: String(normalizeRetentionDays(n, DEFAULT_USAGE_RETENTION_DAYS, MIN_USAGE_RETENTION_DAYS)) };
  }
  if (key === GST_RATE_KEY) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN_GST_RATE || n > MAX_GST_RATE) {
      return { error: `platform_gst_rate must be a decimal between ${MIN_GST_RATE} and ${MAX_GST_RATE} (e.g. 0.18 for 18%)` };
    }
    return { value: String(clampGstRate(n)) };
  }
  if (key === GST_STATE_KEY) {
    const v = value.trim();
    if (v.length > 64) return { error: "platform_gst_state must be 64 characters or fewer" };
    return { value: v };
  }
  if (key === GST_GSTIN_KEY) {
    const v = value.trim().toUpperCase();
    if (!isValidGstin(v)) return { error: "platform_gstin must be a valid 15-character GSTIN (or blank)" };
    return { value: v };
  }
  if (key === GST_MODE_KEY) {
    return { value: normalizeGstMode(value) };
  }
  if (key === BRAND_ADDRESS_KEY) {
    if (value.length > 500) return { error: "Address is too long (max 500 chars)" };
    return { value };
  }
  if (BRAND_TEXT_KEYS.has(key)) {
    if (value.length > 200) return { error: `${key} is too long (max 200 chars)` };
    return { value: value.trim() };
  }
  return { value };
}

async function GET_handler() {
  const rows = await prismaUnscoped.platformSetting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json({ settings });
}

async function PUT_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json().catch(() => ({}));
  const key = String(body.key ?? "").trim();
  const rawValue = String(body.value ?? "");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: `Unknown setting "${key}"` }, { status: 400 });
  }

  const validated = validateValue(key, rawValue);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const value = validated.value;

  const before = await prismaUnscoped.platformSetting.findUnique({ where: { key } });
  const row = await prismaUnscoped.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  logAudit({
    userId: adminId,
    entity: "PlatformSetting",
    entityId: key,
    action: "UPDATE_SETTING",
    before: before ? { value: before.value } : null,
    after: { value: row.value },
  });

  return NextResponse.json({ ok: true, key: row.key, value: row.value });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
