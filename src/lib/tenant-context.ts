import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  /** Company the current request is scoped to. null = platform staff (super admin / support). */
  companyId: string | null;
  userId: string | null;
}

export const tenantALS = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantALS.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return tenantALS.getStore();
}

/** Returns the current companyId or throws — for code paths that must be tenant-scoped. */
export function requireCompanyId(): string {
  const ctx = tenantALS.getStore();
  if (!ctx?.companyId) {
    throw new Error("Tenant context missing: this operation requires a company scope");
  }
  return ctx.companyId;
}
