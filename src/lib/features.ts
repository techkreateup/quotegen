// ─────────────────────────────────────────────────────────────────────────────
// Platform feature / entitlement engine.
//
// Two layers (decided with the product owner):
//   1. PLANS — Starter / Professional / Enterprise. Each plan is a *template* of
//      which features are on and what the usage limits are. Applying a plan to a
//      company writes that template into the company's `featureOverrides`.
//   2. PER-COMPANY OVERRIDES — `Company.featureOverrides` is a JSON map
//      `{ [featureKey]: boolean }`. The Super Admin can flip any single feature on
//      or off for one company, regardless of plan.
//
// Resolution is DEFAULT-ON so existing tenants are never silently broken: a
// feature is enabled unless an override explicitly sets it to `false`.
//   effective(feature) = overrides[feature] !== false
//
// Limits (maxUsers, etc.) live as columns on Company; plans suggest values.
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_CATEGORIES = ["Sales", "Finance", "HR & Payroll", "Operations", "Platform"] as const;
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  category: FeatureCategory;
  /** Tenant module this feature gates (used to hide nav + block routes). Null = capability with no single route. */
  module: string | null;
}

// The catalogue of toggleable features. `module` ties a feature to a route module
// (see src/lib/permissions.ts MODULES) so enforcement can hide/block it.
export const FEATURES: FeatureDef[] = [
  // Sales
  { key: "clients", label: "Clients", description: "Customer directory & CRM", category: "Sales", module: "clients" },
  { key: "quotations", label: "Quotations", description: "Create & send quotes", category: "Sales", module: "quotations" },
  { key: "invoices", label: "Invoices", description: "GST invoicing", category: "Sales", module: "invoices" },
  { key: "receipts", label: "Payment Receipts", description: "Record payments received", category: "Sales", module: "receipts" },
  { key: "credit-notes", label: "Credit Notes", description: "Issue credit notes", category: "Sales", module: "credit-notes" },
  { key: "catalog", label: "Catalog", description: "Reusable item/price catalogue", category: "Sales", module: "catalog" },
  { key: "recurring-invoices", label: "Recurring Invoices", description: "Automated recurring billing", category: "Sales", module: "recurring-invoices" },
  { key: "reminders", label: "Payment Reminders", description: "Automated invoice reminders", category: "Sales", module: "reminders" },

  // Finance
  { key: "transactions", label: "Transactions", description: "Cashbook / ledger", category: "Finance", module: "transactions" },
  { key: "vendors", label: "Vendors", description: "Vendor management & payments", category: "Finance", module: "vendors" },
  { key: "subscriptions", label: "Subscriptions", description: "Track recurring expenses", category: "Finance", module: "subscriptions" },
  { key: "purchase-bills", label: "Purchase Bills", description: "Record purchase bills", category: "Finance", module: "purchase-bills" },
  { key: "gst", label: "GST Filing", description: "GST returns & challans", category: "Finance", module: "gst" },

  // HR & Payroll
  { key: "employees", label: "Employees", description: "Employee directory", category: "HR & Payroll", module: "employees" },
  { key: "salary", label: "Salary", description: "Payroll & salary runs", category: "HR & Payroll", module: "salary" },
  { key: "vouchers", label: "Payment Vouchers", description: "Petty cash / payment vouchers", category: "HR & Payroll", module: "vouchers" },

  // Operations
  { key: "projects", label: "Projects", description: "Project & task tracking", category: "Operations", module: "projects" },
  { key: "workflows", label: "Approval Workflows", description: "Multi-step approval flows", category: "Operations", module: null },
  { key: "audit-logs", label: "Audit Logs", description: "In-app audit trail for the company", category: "Operations", module: "audit-logs" },
  { key: "documents", label: "Document Vault", description: "Store, organize & expire company documents + templates", category: "Operations", module: "documents" },
  { key: "decision-advisor", label: "Decision Advisor", description: "Cross-company benchmarks & win-probability insights (Beta)", category: "Operations", module: null },

  // Platform capabilities (not a single route)
  { key: "api-access", label: "API Access", description: "Programmatic API tokens", category: "Platform", module: null },
  { key: "white-label", label: "White-label Branding", description: "Custom logo, colours & footer on documents", category: "Platform", module: null },
  { key: "multi-currency", label: "Multi-currency", description: "Invoice in multiple currencies", category: "Platform", module: null },
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);
export const FEATURE_BY_KEY: Record<string, FeatureDef> = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

// Module → feature key reverse lookup, for route enforcement.
export const MODULE_TO_FEATURE: Record<string, string> = Object.fromEntries(
  FEATURES.filter((f) => f.module).map((f) => [f.module as string, f.key])
);

export type FeatureMap = Record<string, boolean>;

// ─── Plans ──────────────────────────────────────────────────────────────────

export const PLANS = ["Free", "Starter", "Professional", "Enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanDef {
  name: Plan;
  description: string;
  /** Features enabled by this plan. Anything not listed is OFF when the plan is applied. */
  features: string[];
  /** Suggested seat limit. null = unlimited. */
  maxUsers: number | null;
  /** Future paid tiers are "coming soon" during the launch period. */
  comingSoon: boolean;
  /** Display price / teaser shown on pricing surfaces. */
  price: string;
  /** Canonical price in paise (source of truth for checkout). 0 = free. */
  priceInPaise: number;
  /** Billing cadence: monthly | yearly | one-time. */
  billingPeriod: string;
  /** Free-access window in days (admin-editable; meaningful for the Free plan). */
  trialDurationDays: number;
}

const SALES_CORE = ["clients", "quotations", "invoices", "receipts", "catalog"];

// ─── Launch offer ─────────────────────────────────────────────────────────────
// Decided with the owner: only the Free plan is live; every feature is usable by
// everyone for the launch period. Paid tiers are "coming soon" with a teaser.
export const LAUNCH = {
  /** The one live plan everybody is on right now. */
  livePlan: "Free" as Plan,
  freeMonths: 3,
  /** Catchy term for the pricing teaser. */
  tagline: "Featherlight pricing",
  teaser: "Pricing so light you'll barely feel it. Coming soon.",
  freeNote: "Every feature, free for 3 months — no card, no trial clock.",
};

// "Core" features are the free-forever basics. Everything else becomes a paid
// ("premium") feature once paid tiers launch — flagged with a gem in the app, but
// fully usable during the free launch period.
export const CORE_FEATURES = [...SALES_CORE, "reminders", "transactions"];

/** Will this feature become a paid add-on later? (Drives the gem marker.) */
export function isPremiumFeature(key: string): boolean {
  return FEATURE_KEYS.includes(key) && !CORE_FEATURES.includes(key);
}

/** Premium check by tenant module name (for the sidebar gem). */
export function isPremiumModule(module: string): boolean {
  const key = MODULE_TO_FEATURE[module];
  return key ? isPremiumFeature(key) : false;
}

export const PLAN_DEFS: Record<Plan, PlanDef> = {
  Free: {
    name: "Free",
    description: "Everything unlocked, free during launch",
    features: FEATURE_KEYS,
    maxUsers: null,
    comingSoon: false,
    price: "Free for 3 months",
    priceInPaise: 0,
    billingPeriod: "monthly",
    trialDurationDays: 90,
  },
  Starter: {
    name: "Starter",
    description: "Core invoicing for small teams",
    features: [...SALES_CORE, "reminders"],
    maxUsers: 3,
    comingSoon: true,
    price: "Coming soon",
    priceInPaise: 49900,
    billingPeriod: "monthly",
    trialDurationDays: 90,
  },
  Professional: {
    name: "Professional",
    description: "Full finance, HR & GST suite",
    features: [
      ...SALES_CORE,
      "credit-notes",
      "recurring-invoices",
      "reminders",
      "transactions",
      "vendors",
      "subscriptions",
      "purchase-bills",
      "gst",
      "employees",
      "salary",
      "vouchers",
      "projects",
      "multi-currency",
    ],
    maxUsers: 25,
    comingSoon: true,
    price: "Coming soon",
    priceInPaise: 99900,
    billingPeriod: "monthly",
    trialDurationDays: 90,
  },
  Enterprise: {
    name: "Enterprise",
    description: "Everything, unlimited, with workflows & API",
    features: FEATURE_KEYS,
    maxUsers: null,
    comingSoon: true,
    price: "Coming soon",
    priceInPaise: 249900,
    billingPeriod: "monthly",
    trialDurationDays: 90,
  },
};

const BILLING_PERIOD_SUFFIX: Record<string, string> = { monthly: "/mo", yearly: "/yr", "one-time": "" };

/**
 * Canonical display price for a plan, derived from `priceInPaise` + `billingPeriod`
 * (the source of truth). Returns "Free" for a zero price, else "₹999/mo" etc.
 * Used on /plans, /landing, /checkout and the admin preview so they never drift.
 */
export function formatPlanPrice(priceInPaise: number, billingPeriod: string): string {
  if (!priceInPaise || priceInPaise <= 0) return "Free";
  const rupees = (priceInPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `₹${rupees}${BILLING_PERIOD_SUFFIX[billingPeriod] ?? ""}`;
}

/** Build a full override map from a plan template ({key: true/false} for every feature). */
export function planToOverrides(plan: Plan): FeatureMap {
  const enabled = new Set(PLAN_DEFS[plan]?.features ?? FEATURE_KEYS);
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, enabled.has(k)]));
}

// ─── Resolution & checks ──────────────────────────────────────────────────────

/** Is a single feature effectively enabled for a company? Default-on. */
export function hasFeature(overrides: FeatureMap | null | undefined, key: string): boolean {
  if (!overrides) return true;
  return overrides[key] !== false;
}

/** Resolve every feature to a boolean for a company (for UI display). */
export function resolveFeatures(overrides: FeatureMap | null | undefined): FeatureMap {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, hasFeature(overrides, k)]));
}

/** Count of enabled features, for summaries. */
export function enabledFeatureCount(overrides: FeatureMap | null | undefined): number {
  return FEATURE_KEYS.filter((k) => hasFeature(overrides, k)).length;
}
