// ─── TDS (Tax Deducted at Source) — Indian Income Tax Act §194 / §51 ───────
// Presets for the most common vendor-payment TDS sections so users can pick a
// section instead of memorising the rate. Rates here are the standard resident,
// PAN-provided rates. Non-PAN vendors are deducted at 20% (special rule §206AA),
// which the caller enforces separately. Thresholds are documented but NOT
// enforced by this module — annual aggregation across bills lives in the
// vendor payables view. This keeps per-payment recording deterministic.

export interface TdsSectionDef {
  code: string;         // section key stored on Vendor/VendorPayment
  label: string;        // menu label
  defaultRate: number;  // % deducted (before surcharge/cess)
  threshold: string;    // free-text explanation, shown as a hint
}

export const TDS_SECTIONS: TdsSectionDef[] = [
  { code: "",       label: "No TDS deduction",                     defaultRate: 0,   threshold: "Vendor is exempt / below threshold" },
  { code: "194C",   label: "Sec 194C — Contractor / sub-contractor",   defaultRate: 2,   threshold: "> ₹30,000 single or ₹1,00,000 annual" },
  { code: "194J",   label: "Sec 194J — Professional / technical fees", defaultRate: 10,  threshold: "> ₹30,000 in the FY" },
  { code: "194I",   label: "Sec 194I — Rent (plant/land/building)",    defaultRate: 10,  threshold: "> ₹2,40,000 in the FY" },
  { code: "194H",   label: "Sec 194H — Commission / brokerage",        defaultRate: 5,   threshold: "> ₹15,000 in the FY" },
  { code: "194Q",   label: "Sec 194Q — Purchase of goods",             defaultRate: 0.1, threshold: "> ₹50,00,000 in the FY, on excess" },
  { code: "51",     label: "Sec 51 — Govt./PSU contract (GST TDS)",    defaultRate: 2,   threshold: "Contract > ₹2,50,000" },
];

export function tdsRateFor(code: string): number {
  return TDS_SECTIONS.find((s) => s.code === code)?.defaultRate ?? 0;
}

/** Compute TDS deduction. Round to 2dp; TDS is levied on the pre-GST value in
 *  strict practice, but small vendors bill inclusive — we compute on the gross
 *  amount the user enters and let them override if needed. */
export function computeTds(gross: number, rate: number): { tds: number; net: number } {
  const g = Math.max(0, Number(gross) || 0);
  const r = Math.max(0, Number(rate) || 0);
  const tds = Math.round((g * r) / 100 * 100) / 100;
  return { tds, net: Math.round((g - tds) * 100) / 100 };
}
