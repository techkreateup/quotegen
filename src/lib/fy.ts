// ─── Fiscal-year helpers (client-safe) ───────────────────────────────────────
// Extracted from numbering.ts so client bundles (editor previews) don't drag in
// the server-only `node:async_hooks` chain via tenant-context.
// Kept as pure functions — no I/O, no imports.

export function currentFyLabel(startMonth: number, at: Date = new Date()): { short: string; full: string } {
  const y = at.getFullYear();
  const m = at.getMonth() + 1;
  const startY = m >= (startMonth || 4) ? y : y - 1;
  const endY = startY + 1;
  return {
    short: `${String(startY).slice(-2)}-${String(endY).slice(-2)}`,
    full: `${startY}-${endY}`,
  };
}

export function expandFyTokens(prefix: string, fy: { short: string; full: string }): string {
  return prefix.replace(/\{FYFULL\}/g, fy.full).replace(/\{FY\}/g, fy.short);
}
