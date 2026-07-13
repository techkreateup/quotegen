// ─── Tally XML export (Tier 2) ───────────────────────────────────────────────
// Generates Tally-importable voucher XML (Gateway of Tally → Import Data →
// Vouchers). Pure functions — the API route feeds plain rows in. Ledger names
// follow common CA conventions: party ledger = client/vendor name, plus
// "Sales Account" / "Purchase Account" / bank ledger and CGST/SGST/IGST duty
// ledgers. The accountant maps or auto-creates ledgers on import.

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

const tDate = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
};
const amt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export interface TallyVoucherIn {
  kind: "Sales" | "Purchase" | "Receipt" | "Payment";
  date: Date | string;
  number: string;        // our document number → voucher number
  party: string;         // client / vendor ledger name
  narration?: string;
  subtotal: number;      // taxable value
  cgst: number; sgst: number; igst: number;
  total: number;
}

// Tally convention: DEBIT amounts are negative, CREDIT positive.
function ledgerLines(v: TallyVoucherIn): { name: string; amount: number; deemedPositive: boolean }[] {
  const gst = [
    { name: "CGST", val: v.cgst }, { name: "SGST", val: v.sgst }, { name: "IGST", val: v.igst },
  ].filter((g) => g.val > 0);
  if (v.kind === "Sales")
    return [
      { name: v.party, amount: -v.total, deemedPositive: true },              // Dr party
      { name: "Sales Account", amount: v.subtotal, deemedPositive: false },   // Cr sales
      ...gst.map((g) => ({ name: `Output ${g.name}`, amount: g.val, deemedPositive: false })),
    ];
  if (v.kind === "Purchase")
    return [
      { name: "Purchase Account", amount: -v.subtotal, deemedPositive: true },
      ...gst.map((g) => ({ name: `Input ${g.name}`, amount: -g.val, deemedPositive: true })),
      { name: v.party, amount: v.total, deemedPositive: false },              // Cr vendor
    ];
  if (v.kind === "Receipt")
    return [
      { name: "Bank", amount: -v.total, deemedPositive: true },
      { name: v.party, amount: v.total, deemedPositive: false },
    ];
  return [
    { name: v.party, amount: -v.total, deemedPositive: true },
    { name: "Bank", amount: v.total, deemedPositive: false },
  ];
}

export function voucherXml(v: TallyVoucherIn): string {
  const lines = ledgerLines(v)
    .filter((l) => Math.abs(l.amount) >= 0.005)
    .map(
      (l) => `      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(l.name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${l.deemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(l.amount)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`
    )
    .join("\n");
  return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${v.kind}" ACTION="Create">
      <DATE>${tDate(v.date)}</DATE>
      <VOUCHERTYPENAME>${v.kind}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${esc(v.number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${esc(v.party)}</PARTYLEDGERNAME>
      <NARRATION>${esc(v.narration ?? "")}</NARRATION>
${lines}
     </VOUCHER>
    </TALLYMESSAGE>`;
}

export function tallyEnvelope(vouchers: TallyVoucherIn[], companyName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES><SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${vouchers.map(voucherXml).join("\n")}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}
