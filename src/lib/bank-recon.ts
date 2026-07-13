// ─── Bank statement import + auto-reconciliation (Tier 2) ────────────────────
// Pure functions: tolerant bank-CSV parsing + scoring matcher that suggests
// which open invoice (credits) or vendor bill (debits) a bank row settles.
// The API route supplies open documents; the user confirms each suggestion —
// nothing is auto-posted.

export interface BankRow {
  date: string;        // as found in the statement
  description: string;
  amount: number;      // signed: credit +, debit −
  reference: string;
}

export interface OpenDoc {
  id: string;
  number: string;      // invoiceNo / billNo
  party: string;       // client / vendor name
  partyId: string;
  outstanding: number;
}

export interface Suggestion {
  row: BankRow;
  side: "receivable" | "payable";
  docId: string | null;
  docNumber: string | null;
  party: string | null;
  partyId: string | null;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Tolerant CSV parser for Indian bank statements. Handles quoted fields,
 *  ₹/comma-formatted numbers, and either a signed Amount column or separate
 *  Credit/Debit (or Deposit/Withdrawal) columns. Header row is located by
 *  keyword, so leading bank boilerplate lines are skipped. */
export function parseBankCsv(text: string): BankRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (line: string): string[] => {
    const out: string[] = []; let cur = ""; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim().replace(/^"|"$/g, ""));
  };
  const headerIdx = lines.findIndex((l) => /date/i.test(l) && /(desc|narrat|particular|remark)/i.test(l));
  if (headerIdx === -1) return [];
  const header = split(lines[headerIdx]).map((h) => h.toLowerCase());
  const col = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  // "cr"/"dr" are matched as whole words only — "description" contains "cr".
  const colWord = (word: string, ...keys: string[]) =>
    header.findIndex((h) => keys.some((k) => h.includes(k)) || new RegExp(`\\b${word}\\b`).test(h));
  const iDate = col("date");
  const iDesc = col("desc", "narrat", "particular", "remark");
  const iRef = col("ref", "utr", "cheque", "chq");
  const iAmount = col("amount");
  const iCredit = colWord("cr", "credit", "deposit");
  const iDebit = colWord("dr", "debit", "withdraw");
  const num = (s: string | undefined) => {
    const n = parseFloat(String(s ?? "").replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  return lines.slice(headerIdx + 1).flatMap((line) => {
    const c = split(line);
    if (c.length < 2) return [];
    let amount = 0;
    if (iCredit !== -1 || iDebit !== -1) {
      amount = num(c[iCredit]) - num(c[iDebit]);
    } else if (iAmount !== -1) {
      amount = num(c[iAmount]);
      // Some banks mark direction with a trailing CR/DR tag instead of a sign.
      if (/\bdr\b/i.test(c[iAmount] ?? "")) amount = -Math.abs(amount);
    }
    if (amount === 0) return [];
    return [{
      date: c[iDate] ?? "",
      description: c[iDesc] ?? "",
      amount,
      reference: iRef !== -1 ? (c[iRef] ?? "") : "",
    }];
  });
}

function matchOne(row: BankRow, docs: OpenDoc[]): Omit<Suggestion, "row" | "side"> {
  const hay = norm(row.description + " " + row.reference);
  const abs = Math.abs(row.amount);

  // 1) document number appearing in the narration — strongest signal.
  const byNo = docs.find((d) => d.number && hay.includes(norm(d.number)));
  if (byNo) return { docId: byNo.id, docNumber: byNo.number, party: byNo.party, partyId: byNo.partyId, confidence: "high", reason: `Doc no ${byNo.number} in narration` };

  // 2) exact outstanding amount (±1 paise-rounding rupee) — unique hit only.
  const byAmt = docs.filter((d) => Math.abs(d.outstanding - abs) <= 1);
  if (byAmt.length === 1) {
    const d = byAmt[0];
    const partyToo = hay.includes(norm(d.party).slice(0, 6));
    return { docId: d.id, docNumber: d.number, party: d.party, partyId: d.partyId, confidence: partyToo ? "high" : "medium", reason: partyToo ? "Amount + party name match" : "Unique amount match" };
  }

  // 3) party name in narration → weakest; pick their largest open doc.
  const byParty = docs.filter((d) => d.party.length >= 4 && hay.includes(norm(d.party).slice(0, 8)));
  if (byParty.length > 0) {
    const d = [...byParty].sort((a, b) => b.outstanding - a.outstanding)[0];
    return { docId: d.id, docNumber: d.number, party: d.party, partyId: d.partyId, confidence: "low", reason: "Party name in narration" };
  }
  return { docId: null, docNumber: null, party: null, partyId: null, confidence: "none", reason: "No match" };
}

export function reconcile(rows: BankRow[], openInvoices: OpenDoc[], openBills: OpenDoc[]): Suggestion[] {
  const used = new Set<string>();
  return rows.map((row) => {
    const side = row.amount > 0 ? "receivable" as const : "payable" as const;
    const pool = (side === "receivable" ? openInvoices : openBills).filter((d) => !used.has(d.id));
    const m = matchOne(row, pool);
    if (m.docId && m.confidence !== "low") used.add(m.docId); // one bank row per doc for confident matches
    return { row, side, ...m };
  });
}
