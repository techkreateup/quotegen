"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Horizontal snap-scroll gallery of REAL document outputs the app produces.
 * Sourced from DocumentPreview.tsx type union: Quotation, Invoice, Payment
 * Receipt, Sales Order, Delivery Challan, Proforma, Purchase Order, GRN,
 * Debit Note, plus the GSTR-1 export and a Salary Slip.
 */

type Doc = {
  kind: string;
  no: string;
  title: string;
  party: string;
  gstin?: string;
  date: string;
  lines: { d: string; extra?: string; a: string }[];
  total: string;
  chip?: { label: string; tone: "brand" | "ink" | "warn" };
  extra?: React.ReactNode;
};

const DOCS: Doc[] = [
  { kind: "Quotation", no: "Q-00312", title: "Quotation", party: "Example Studio", gstin: "GSTIN 29AAFCP1234E1Z8", date: "18 Jun 2026",
    lines: [
      { d: "Brand identity — logo + 3 revs", extra: "998391", a: "62,000.00" },
      { d: "Web design — 8 pages",           extra: "998391", a: "1,20,000.00" },
      { d: "Photography — 2 day shoot",      extra: "998387", a: "45,000.00" },
    ],
    total: "₹ 2,63,610.00",
    chip: { label: "Sent", tone: "ink" } },

  { kind: "Tax Invoice", no: "INV-00248", title: "Tax Invoice", party: "Sundaram Steel Works", gstin: "GSTIN 33AABCS4123A1Z9", date: "04 Jul 2026",
    lines: [
      { d: "MS Angle 50×50×5, cut to length", extra: "72161000", a: "10,920.00" },
      { d: "Fabrication labour, on-site",     extra: "998873",   a: "18,500.00" },
      { d: "Painting, red oxide primer",      extra: "998518",   a:  "3,200.00" },
    ],
    total: "₹ 38,491.60",
    chip: { label: "Paid", tone: "brand" } },

  { kind: "Payment Receipt", no: "PR-00317", title: "Payment Receipt", party: "Sundaram Steel Works", gstin: "GSTIN 33AABCS4123A1Z9", date: "04 Jul 2026",
    lines: [
      { d: "Ref invoice INV-00248", extra: "UPI", a: "38,491.60" },
    ],
    total: "₹ 38,491.60",
    chip: { label: "Received", tone: "brand" },
    extra: (
      <div className="mt-3 text-[10px] rounded-md px-2 py-1.5 lp-num" style={{ background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" }}>
        UPI · sundaram@icici · Ref TXN0704251
      </div>
    ) },

  { kind: "Sales Order", no: "SO-00104", title: "Sales Order", party: "GreenLeaf Traders", gstin: "GSTIN 32AABCG8712F1Z3", date: "22 Jun 2026",
    lines: [
      { d: "Organic tea, 250g pouches",  extra: "50 ×", a: "37,500.00" },
      { d: "Herbal chai mix, 100g",      extra: "80 ×", a: "24,000.00" },
      { d: "Gift box packaging",         extra: "12 ×", a:  "6,000.00" },
    ],
    total: "₹ 79,650.00",
    chip: { label: "Confirmed", tone: "brand" } },

  { kind: "Delivery Challan", no: "DC-00088", title: "Delivery Challan", party: "GreenLeaf Traders", date: "25 Jun 2026",
    lines: [
      { d: "Organic tea, 250g pouches", extra: "50 pcs", a: "12.5 kg" },
      { d: "Herbal chai mix, 100g",     extra: "80 pcs", a:  "8.0 kg" },
    ],
    total: "3 cartons",
    chip: { label: "Dispatched", tone: "ink" },
    extra: (
      <div className="mt-3 text-[10px]" style={{ color: "var(--lp-mute)" }}>Vehicle TN-38-BC-1948 · e-Way bill 341082930918</div>
    ) },

  { kind: "Purchase Order", no: "PO-00042", title: "Purchase Order", party: "Sagar Traders", gstin: "GSTIN 27AAACS9876P1Z4", date: "12 Jun 2026",
    lines: [
      { d: "MS sheet 3mm, 8×4 ft", extra: "20 pcs", a: "84,000.00" },
      { d: "Angle bar 40×40×5",    extra: "50 kg",  a: "11,500.00" },
    ],
    total: "₹ 1,12,690.00",
    chip: { label: "Approved", tone: "brand" } },

  { kind: "Goods Receipt", no: "GRN-00061", title: "Goods Receipt Note", party: "Sagar Traders", date: "16 Jun 2026",
    lines: [
      { d: "MS sheet 3mm, 8×4 ft", extra: "20 / 20", a: "OK" },
      { d: "Angle bar 40×40×5",    extra: "48 / 50", a: "Short 2 kg" },
    ],
    total: "Received",
    chip: { label: "Short recv", tone: "warn" } },

  { kind: "Credit Note", no: "CN-00007", title: "Credit Note", party: "Example Studio", gstin: "GSTIN 29AAFCP1234E1Z8", date: "02 Jul 2026",
    lines: [
      { d: "Revision credit against INV-00241", extra: "998391", a: "12,000.00" },
    ],
    total: "₹ 14,160.00",
    chip: { label: "Issued", tone: "ink" } },

  { kind: "Salary Slip", no: "PAY-00092", title: "Salary Slip · July 2026", party: "R. Priya (name changed)", date: "31 Jul 2026",
    lines: [
      { d: "Basic",     extra: "",        a: "40,000.00" },
      { d: "HRA",       extra: "",        a: "16,000.00" },
      { d: "PF 12%",    extra: "deduct",  a: " 4,800.00" },
      { d: "Prof tax",  extra: "deduct",  a: "   200.00" },
    ],
    total: "₹ 51,000.00",
    chip: { label: "Net pay", tone: "brand" } },

  { kind: "GSTR-1", no: "R1-JUN26", title: "GSTR-1 · June 2026", party: "Kaveri Fabrication LLP", date: "10 Jul 2026",
    lines: [
      { d: "B2B invoices",     extra: "12 docs", a: "58,691.00" },
      { d: "B2C (Small)",      extra: "27 docs", a: "18,354.00" },
      { d: "Credit notes",     extra:  "1 doc",  a: " 1,220.00" },
    ],
    total: "₹ 78,265.00",
    chip: { label: "Ready to file", tone: "brand" } },
];

export default function DocumentGallery() {
  const rail = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Nav arrows */}
      <div className="flex justify-end gap-2 mb-4">
        <button onClick={() => scrollBy(-1)} aria-label="Scroll left"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center transition-transform active:scale-[0.94]"
                style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
          <ArrowLeft size={14} />
        </button>
        <button onClick={() => scrollBy(1)} aria-label="Scroll right"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center transition-transform active:scale-[0.94]"
                style={{ background: "var(--lp-ink)", color: "white", border: "1px solid var(--lp-ink)" }}>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Rail */}
      <div ref={rail}
           className="flex gap-5 overflow-x-auto pb-6 -mx-5 sm:-mx-8 px-5 sm:px-8 snap-x snap-mandatory scroll-smooth"
           style={{ scrollbarWidth: "none" }}>
        <style>{`.doc-rail::-webkit-scrollbar { display: none; }`}</style>
        {DOCS.map((d, i) => (
          <DocCard key={d.no} doc={d} idx={i} />
        ))}
      </div>
    </div>
  );
}

function DocCard({ doc: d, idx }: { doc: Doc; idx: number }) {
  const chipStyle = d.chip
    ? {
        brand: { background: "var(--lp-brand-tint)", color: "var(--lp-brand-ink)" },
        ink:   { background: "var(--lp-line-2)", color: "var(--lp-ink)" },
        warn:  { background: "oklch(0.94 0.09 75)", color: "oklch(0.35 0.13 75)" },
      }[d.chip.tone]
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: (idx % 3) * 0.08, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -6, boxShadow: "0 30px 60px -20px oklch(0.2 0.02 240 / 0.28)" }}
      className="snap-start shrink-0 rounded-2xl overflow-hidden"
      style={{
        width: "min(360px, 78vw)",
        background: "var(--lp-paper)",
        border: "1px solid var(--lp-line)",
        boxShadow: "0 20px 40px -20px oklch(0.2 0.02 240 / 0.18)",
      }}
    >
      {/* Head */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--lp-line)" }}>
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>{d.kind}</p>
          <p className="lp-num text-[12.5px] font-semibold mt-0.5">{d.no}</p>
        </div>
        {d.chip && (
          <span className="text-[9.5px] uppercase tracking-widest px-2 py-0.5 rounded lp-num" style={chipStyle}>
            {d.chip.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Party</p>
            <p className="text-[13px] font-semibold mt-0.5">{d.party}</p>
            {d.gstin && <p className="text-[9.5px] lp-num" style={{ color: "var(--lp-mute)" }}>{d.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--lp-mute)" }}>Date</p>
            <p className="text-[10.5px] lp-num mt-0.5">{d.date}</p>
          </div>
        </div>

        <div className="mt-3 divide-y" style={{ borderColor: "var(--lp-line-2)" }}>
          {d.lines.map((l) => (
            <div key={l.d} className="grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 text-[11px]">
              <span>{l.d}</span>
              <span className="lp-num text-right px-2" style={{ color: "var(--lp-mute)" }}>{l.extra ?? ""}</span>
              <span className="lp-num text-right">{l.a}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 text-[13px] font-semibold" style={{ borderTop: "1px solid var(--lp-line)" }}>
          <span>Total</span>
          <span className="lp-num" style={{ color: "var(--lp-brand-ink)" }}>{d.total}</span>
        </div>

        {d.extra}
      </div>
    </motion.div>
  );
}
