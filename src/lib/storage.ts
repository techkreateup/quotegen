import { prismaUnscoped } from "@/lib/db";

// The UploadThing free plan is 2 GB, shared across the whole app (one account/
// token serves all tenants). We track usage from Document.sizeBytes and refuse
// uploads that would push the GLOBAL total past a safety ceiling, leaving
// headroom for avatars/logos and in-flight uploads.
export const STORAGE_LIMIT_BYTES = 2 * 1024 ** 3; // 2 GB
export const STORAGE_SAFETY_BYTES = Math.floor(1.9 * 1024 ** 3); // ~1.9 GB cap

export async function globalStorageBytes(): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({ _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

export async function companyStorageBytes(companyId: string): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({
    where: { companyId },
    _sum: { sizeBytes: true },
  });
  return agg._sum.sizeBytes ?? 0;
}

/**
 * Throw a descriptive error if accepting up to `incomingMaxBytes` more would
 * exceed the global safety ceiling. Called from the upload middleware (which
 * runs before the file is sent), so we check against the file's max size.
 */
export async function assertStorageAvailable(incomingMaxBytes: number): Promise<void> {
  const used = await globalStorageBytes();
  if (used + incomingMaxBytes > STORAGE_SAFETY_BYTES) {
    throw new Error(
      "Storage limit reached. Please delete some documents before uploading more."
    );
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
