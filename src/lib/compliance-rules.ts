// ─── Compliance rule engine (SPRINT §9 / §11) ────────────────────────────────
// Baked correctness for GST-adjacent rules so the app can surface advisories
// today. Live govt-API integrations (IRN generation, e-way bill push, ITC
// reversal APIs) stay deferred to the MNC-tier overlay phase per §11 scope.
//
// Everything here is a PURE function: no DB, no I/O. Callers pass in the doc
// data they already have. UI banners consume the returned `{applies, message}`
// shape and render a single line — no schema changes required.

/** e-Invoice IRN cancellation window (Rule 48/GSTN): 24h from IRN generation. */
export function einvoiceCancelStatus(
  invoiceDate: Date | string | null | undefined,
  now: Date = new Date()
): { withinWindow: boolean; hoursLeft: number; message: string } {
  if (!invoiceDate) return { withinWindow: false, hoursLeft: 0, message: "" };
  const issued = new Date(invoiceDate).getTime();
  if (!Number.isFinite(issued)) return { withinWindow: false, hoursLeft: 0, message: "" };
  const deadlineMs = issued + 24 * 3600_000;
  const hoursLeft = Math.max(0, Math.round((deadlineMs - now.getTime()) / 3600_000));
  const withinWindow = now.getTime() < deadlineMs;
  return {
    withinWindow,
    hoursLeft,
    message: withinWindow
      ? `e-Invoice can still be cancelled via the IRP (${hoursLeft}h left in the 24h window).`
      : `24h e-Invoice cancel window has closed — issue a credit note instead.`,
  };
}

/** e-Way Bill threshold (Rule 138): consignment value > ₹50,000. */
export function ewayRequired(totalAmount: number): { applies: boolean; message: string } {
  const applies = (totalAmount ?? 0) > 50_000;
  return {
    applies,
    message: applies
      ? "Consignment > ₹50,000 — e-Way Bill required before goods movement (Rule 138)."
      : "",
  };
}

/** Reverse-charge suspicion (§9(3)/(4)): unregistered vendor supplying goods/
 * services to a registered buyer triggers RCM. This is a heuristic advisory —
 * final call needs the CA/user (notified supplies vary). */
export function rcmSuspected(vendor: {
  gstin?: string | null;
  state?: string | null;
} | null | undefined): { applies: boolean; reason: string; message: string } {
  const gstin = (vendor?.gstin ?? "").trim();
  if (!gstin) {
    return {
      applies: true,
      reason: "vendor-unregistered",
      message: "Vendor has no GSTIN — RCM likely applies (§9(4)). Self-invoice + pay tax.",
    };
  }
  return { applies: false, reason: "", message: "" };
}

/** TDS advisory (§51 GST-TDS + §194C income-tax TDS). Rates live in tds.ts;
 * this helper flags the *threshold* so the UI can nudge the user. */
export function tdsAdvisory(
  contractValue: number
): { section51: boolean; section194C: boolean; message: string } {
  const s51 = contractValue > 2_50_000;
  const s194 = contractValue > 30_000;
  const notes: string[] = [];
  if (s51) notes.push("§51 GST-TDS: 2% on contract > ₹2.5L");
  if (s194) notes.push("§194C: 1–2% TDS (single > ₹30k)");
  return { section51: s51, section194C: s194, message: notes.join(" · ") };
}
