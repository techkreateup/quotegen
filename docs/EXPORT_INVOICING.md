# Export & Foreign-Client Invoicing — Shipped v1 + Roadmap (2026-07-08)

## Shipped (v1)
- Detection: client `country !== "India"` → export invoice automatically.
  - `Invoice.isExport` column (default false), set by the editor on save.
  - Interstate check is skipped for exports (no IGST split by state).
- Tax: zero-rated under LUT — `calculateLineItem(item, isInterState, zeroTax)`
  computes 0 GST when `zeroTax`; editor passes `zeroTax={isExport}` and shows a
  banner. Item `gstRate` is preserved for reference.
- PDF: type `"Export Invoice"` in DocumentPreview → "Exporter"/"Consignee"
  labels + mandatory LUT declaration line (Sec 16 IGST Act). Currency symbol
  comes from `client.currency` via the new `currency` prop (₹ default;
  USD/EUR/GBP/AED/SGD/AUD/CAD mapped, anything else printed as-is).
- GSTR-1: export invoices are EXCLUDED from B2B/B2C tables and returned as a
  separate `exports` array (table 6A) by /api/gst-report?type=gstr1.

## v2 roadmap (build when an exporting tenant asks)
1. **Exports WITH payment of IGST** — toggle per invoice (LUT vs IGST-paid);
   IGST-paid exports charge IGST and claim refund. Needs `exportType` column
   ("LUT" | "IGST") instead of the boolean.
2. **Shipping bill capture** — shipping bill no/date/port code fields on the
   invoice (required in GSTR-1 6A and for e-invoice `EXPWP/EXPWOP`).
3. **Exchange rate** — capture RBI/customs rate on invoice date; store both
   FX amount and INR value (books must be INR). Currently amounts are entered
   in the client currency and books show the same number — fine for services
   quoting in INR-equivalent, wrong for true FX books. Fix with
   `exchangeRate Float @default(1)` + INR mirror columns.
4. **Amount-in-words** — numberToWords still says Rupees; parameterize by
   currency when FX support lands.
5. **SEZ supplies** — India-located but zero-rated (SEZWP/SEZWOP); detect via a
   client `isSez` flag, not country.
6. **GSTR-1 6A JSON export** + e-invoice export type when the IRN integration
   (TECH_DEBT #2 prerequisite) is built.
7. **FIRC/BRC tracking** — link payment receipts to FIRC references for RBI
   compliance on service exports.
