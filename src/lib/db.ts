import { PrismaClient } from "@prisma/client";
import { tenantALS } from "@/lib/tenant-context";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

// Connection pooling is controlled by the connection string. In production
// DATABASE_URL must point at Neon's POOLED host (contains "-pooler"). Neon's
// pooler is PgBouncer in transaction mode, which does NOT support the prepared
// statements Prisma uses by default — so the URL MUST carry `pgbouncer=true`,
// or queries intermittently hang/error under concurrency on serverless. We
// enforce that here so a misconfigured env var can't break production: when the
// URL targets a pooler host, append pgbouncer=true + a small connection_limit
// if missing. DIRECT_URL (non-pooled) is used only for migrations.
function pooledDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  // Only adjust when talking to a PgBouncer pooler host.
  if (!raw.includes("-pooler")) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "10");
    return url.toString();
  } catch {
    return raw; // malformed — let Prisma surface its own error
  }
}

const datasourceUrl = pooledDatabaseUrl();
const base =
  globalForPrisma.prismaBase ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

/**
 * Models that carry a companyId column and must always be tenant-scoped.
 * Any query on these through the default client is automatically filtered
 * (reads) and stamped (writes) with the companyId from the request's
 * AsyncLocalStorage context — and REJECTED if no context exists.
 *
 * Not listed (scoped via parent or handled manually):
 * - line items / WorkflowStep / WorkflowApproval / IssueComment / Notification
 *   (reachable only through their scoped parent)
 * - User (nullable companyId; scoped explicitly in user routes)
 * - Company / OnboardingProgress / UsageEvent / Issue (platform-managed; Issue
 *   is in the list because tenant users query it directly)
 */
const TENANT_MODELS = new Set([
  "CompanySettings",
  "UserRole",
  "Client",
  "Quotation",
  "Invoice",
  "PaymentReceipt",
  "Employee",
  "SalaryRecord",
  "PaymentVoucher",
  "Transaction",
  "Subscription",
  "SubscriptionPayment",
  "Vendor",
  "VendorPayment",
  "Project",
  "ProjectTask",
  "ActivityLog",
  "CreditNote",
  "CatalogItem",
  "RecurringInvoice",
  "GstFiling",
  "PurchaseBill",
  "GstChallan",
  "EntityActivity",
  "EntityNote",
  "InvoiceReminder",
  "AuditLog",
  "Workflow",
  "WorkflowInstance",
  "Issue",
  "SubscriptionInvoice",
  "ApiKey",
  // Carries companyId; auto-scope it too. Platform-level reads (webhook, cron,
  // admin revenue/refund) deliberately use prismaUnscoped.
  "BillingPayment",
  // Document Vault (Phase 2) — tenant-scoped. Global usage totals for the storage
  // quota use prismaUnscoped on purpose (see src/lib/storage.ts).
  "Document",
  // Decision Advisor (Phase 3) — per-tenant cached recommendations. The learning
  // tables AdvisorEvent + AdvisorCohortStat are deliberately GLOBAL (not here):
  // they hold only de-identified aggregates and are read/written unscoped by the
  // aggregation job and serving layer. See src/lib/advisor/.
  "AdvisorRecommendation",
  // Saved templates (org-wide reusable). Versions reached via the scoped parent.
  "SavedTemplate",
  // Signature library + applied document signatures (both carry companyId).
  "Signature",
  "DocumentSignature",
]);

/** AuditLog allows null companyId (platform staff actions). */
const NULLABLE_COMPANY_MODELS = new Set(["AuditLog"]);

const WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);

type AnyArgs = Record<string, unknown>;

const prisma = base.$extends({
  name: "tenant-scoping",
  query: {
    $allOperations({ model, operation, args, query }) {
      if (!model || !TENANT_MODELS.has(model)) return query(args);
      if (operation.startsWith("$") || operation.endsWith("Raw")) return query(args);

      const ctx = tenantALS.getStore();
      if (!ctx) {
        throw new Error(
          `Tenant context missing for ${model}.${operation}. ` +
            `Wrap the handler in withApi()/runWithTenant(), or use prismaUnscoped for platform-level access.`
        );
      }
      const companyId = ctx.companyId;
      if (companyId === null && !NULLABLE_COMPANY_MODELS.has(model)) {
        throw new Error(
          `Platform-staff context cannot access tenant model ${model} via the scoped client. Use prismaUnscoped.`
        );
      }

      const a = (args ?? {}) as AnyArgs;

      if (WHERE_OPS.has(operation)) {
        a.where = { ...((a.where as AnyArgs) ?? {}), companyId };
      }
      if (CREATE_OPS.has(operation)) {
        if (operation === "upsert") {
          a.create = { ...((a.create as AnyArgs) ?? {}), companyId };
        } else if (Array.isArray(a.data)) {
          a.data = (a.data as AnyArgs[]).map((d) => ({ ...d, companyId }));
        } else {
          a.data = { ...((a.data as AnyArgs) ?? {}), companyId };
        }
      }

      return query(a as never);
    },
  },
});

/**
 * Unscoped client — bypasses tenant isolation entirely.
 * Only for: signup, login, platform admin/support APIs, seeds, and scripts.
 * Every new usage should be deliberate and reviewed.
 */
export const prismaUnscoped = base;

export default prisma;
