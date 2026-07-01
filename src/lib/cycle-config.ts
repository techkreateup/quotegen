// ─── Adaptive cycle/stage config (Track E) ───────────────────────────────────
// Single source of truth for the three business cycles and the document "stages"
// within each. The first-run setup wizard writes a per-company CycleConfig (stored
// on CompanySettings.cycleConfig); the Sidebar and modules read it to show only
// the stages a company actually uses — so a solo freelancer sees a 3-document app
// and an MNC sees the full suite, from the same codebase.
//
// Non-destructive: turning a stage off only HIDES it (data is preserved). This is
// pure config logic with no server deps, so client and server both import it.

export type Cycle = "sell" | "buy" | "hr";

// Every possible stage per cycle, in lifecycle order. `module` maps a stage to the
// permission module / sidebar route key it controls (when one exists yet).
export interface StageDef { key: string; label: string; module?: string }

export const CYCLE_STAGES: Record<Cycle, StageDef[]> = {
  sell: [
    { key: "quotation", label: "Quotations", module: "quotations" },
    { key: "salesOrder", label: "Sales Orders", module: "sales-orders" },        // Track D
    { key: "deliveryChallan", label: "Delivery Challans", module: "delivery-challans" }, // Track D
    { key: "invoice", label: "Invoices", module: "invoices" },
    { key: "receipt", label: "Payment Receipts", module: "receipts" },
    { key: "creditNote", label: "Credit Notes", module: "credit-notes" },
    { key: "recurring", label: "Recurring Invoices", module: "recurring-invoices" },
  ],
  buy: [
    { key: "purchaseOrder", label: "Purchase Orders", module: "purchase-orders" },  // Track A
    { key: "grn", label: "Goods Receipt Notes", module: "goods-receipts" },        // Track A
    { key: "bill", label: "Purchase Bills", module: "purchase-bills" },
    { key: "debitNote", label: "Debit Notes", module: "debit-notes" },          // Track A
    { key: "vendorPayment", label: "Vendors & Payments", module: "vendors" },
  ],
  hr: [
    { key: "employees", label: "Employees", module: "employees" },
    { key: "salary", label: "Salary", module: "salary" },
    { key: "idcard", label: "ID Cards" },                // Track C (future)
    { key: "assets", label: "Asset Management", module: "assets" },        // Track C
    { key: "fnf", label: "Full & Final Settlement", module: "fnf" },    // Track C
  ],
};

export interface BusinessProfile {
  businessType: "service" | "trading" | "manufacturing" | "mixed";
  sellsGoods: boolean;
  buysStock: boolean;
  hasEmployees: boolean;
  teamSize: "solo" | "small" | "medium" | "large";
  // Number GST and non-GST invoices in separate series (auto-detected per client
  // GSTIN). Doesn't affect cycle stages — carried here for the setup wizard.
  separateGstInvoices?: boolean;
}

export interface CycleSetting { stages: string[]; approvals: boolean }
export type CycleConfig = Record<Cycle, CycleSetting>;

/**
 * Compute sensible default stages from a business profile. Keeps the common path
 * minimal: everyone sells (quote→invoice→receipt); goods sellers add SO+challan;
 * stock buyers get the full procurement chain; employers get HR. Approvals turn
 * on for medium/large teams (the MNC tier).
 */
export function defaultCycleConfig(p: BusinessProfile): CycleConfig {
  const approvals = p.teamSize === "medium" || p.teamSize === "large";

  const sell = ["quotation", "invoice", "receipt", "creditNote", "recurring"];
  if (p.sellsGoods || p.businessType === "trading" || p.businessType === "manufacturing") {
    sell.splice(1, 0, "salesOrder", "deliveryChallan");
  }

  // Even service businesses record vendor bills & payments; stock buyers get the
  // full PO→GRN→debit-note chain.
  const buy = ["bill", "vendorPayment"];
  if (p.buysStock || p.businessType === "trading" || p.businessType === "manufacturing") {
    buy.unshift("purchaseOrder", "grn");
    buy.splice(buy.indexOf("bill") + 1, 0, "debitNote");
  }

  const hr = p.hasEmployees ? ["employees", "salary", "idcard", "assets", "fnf"] : [];

  return {
    sell: { stages: sell, approvals },
    buy: { stages: buy, approvals },
    hr: { stages: hr, approvals },
  };
}

/** A permissive config used when a company hasn't run the wizard (everything on),
 *  so existing tenants never lose access (opt-out, not opt-in — LEARNING §2.5). */
export function allStagesConfig(): CycleConfig {
  return {
    sell: { stages: CYCLE_STAGES.sell.map((s) => s.key), approvals: false },
    buy: { stages: CYCLE_STAGES.buy.map((s) => s.key), approvals: false },
    hr: { stages: CYCLE_STAGES.hr.map((s) => s.key), approvals: false },
  };
}

/** Parse a stored cycleConfig JSON; falls back to all-on when empty/invalid. */
export function parseCycleConfig(raw: unknown): CycleConfig {
  if (raw && typeof raw === "object") {
    const c = raw as Partial<CycleConfig>;
    if (c.sell?.stages || c.buy?.stages || c.hr?.stages) {
      const fix = (s?: CycleSetting): CycleSetting =>
        s && Array.isArray(s.stages) ? { stages: s.stages, approvals: !!s.approvals } : { stages: [], approvals: false };
      return { sell: fix(c.sell), buy: fix(c.buy), hr: fix(c.hr) };
    }
  }
  return allStagesConfig();
}

/** Set of permission-module keys enabled by a cycle config — for sidebar gating. */
export function enabledModules(config: CycleConfig): Set<string> {
  const mods = new Set<string>();
  for (const cycle of Object.keys(CYCLE_STAGES) as Cycle[]) {
    const enabled = new Set(config[cycle].stages);
    for (const stage of CYCLE_STAGES[cycle]) {
      if (stage.module && enabled.has(stage.key)) mods.add(stage.module);
    }
  }
  return mods;
}
