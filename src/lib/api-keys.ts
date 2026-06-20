import { createHash, randomBytes } from "crypto";
import { prismaUnscoped } from "@/lib/db";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generates a new raw API key and its storage fields. Raw is shown once. */
export function generateApiKey(): { raw: string; keyHash: string; keyPrefix: string } {
  const raw = `qg_live_${randomBytes(24).toString("base64url")}`;
  return { raw, keyHash: hashKey(raw), keyPrefix: `${raw.slice(0, 12)}…` };
}

/**
 * Resolves an API key to its company. Returns null if missing/invalid/inactive.
 * Updates lastUsedAt opportunistically.
 */
export async function resolveApiKey(raw: string): Promise<{ companyId: string } | null> {
  if (!raw) return null;
  const key = await prismaUnscoped.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!key || !key.isActive) return null;
  prismaUnscoped.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { companyId: key.companyId };
}
