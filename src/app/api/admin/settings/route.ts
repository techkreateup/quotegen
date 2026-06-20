import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  AUDIT_RETENTION_KEY, MIN_AUDIT_RETENTION_DAYS, MAX_AUDIT_RETENTION_DAYS,
  USAGE_RETENTION_KEY, MIN_USAGE_RETENTION_DAYS,
  normalizeRetentionDays, DEFAULT_AUDIT_RETENTION_DAYS, DEFAULT_USAGE_RETENTION_DAYS,
} from "@/lib/retention";

// Platform-wide key/value settings (super-admin only; gated by proxy).
// GET → { [key]: value }   PUT { key, value } → upsert.
//
// Only known keys are writable, and retention windows are validated/clamped to
// safe ranges so a stray value can't trigger a near-total data wipe.
const ALLOWED_KEYS = new Set([AUDIT_RETENTION_KEY, USAGE_RETENTION_KEY]);

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
