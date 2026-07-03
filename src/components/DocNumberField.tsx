"use client";

import { AlertTriangle } from "lucide-react";

// Shared doc-number input used by every doc editor (invoice, quotation, SO,
// DC, PO, GRN, DN, CN, PB). Shows an auto-issue preview line beneath the input
// once we know what the next number will be, an inline red duplicate warning
// when the value clashes with an existing one, and lets the user click the
// preview to fill the field. Keeps the "Save" button behavior as before — the
// PARENT owns the disabled state via the same `duplicate` flag.

interface Props {
  label: string;                 // e.g. "Invoice No", "Quotation No"
  value: string;
  onChange: (v: string) => void;
  editing: boolean;              // true when editing an existing doc
  previewNo: string;             // "" until enough context to compute
  previewNote?: string;          // "GST series", "Non-GST series", etc.
  duplicate: boolean;
  labelKind: string;             // "invoice number", "quotation number" — used in the warning
  waitingFor?: string;           // e.g. "client" | "vendor"; drives the "Pick a X to preview…" line
}

export default function DocNumberField({
  label, value, onChange, editing, previewNo, previewNote,
  duplicate, labelKind, waitingFor,
}: Props) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className={`inp font-mono${duplicate ? " !border-red-400 !ring-red-100" : ""}`}
        placeholder={editing ? "" : (previewNo || (waitingFor ? `select ${waitingFor} first` : "auto"))}
      />
      {duplicate ? (
        <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> This {labelKind} is already in use. Pick another.
        </p>
      ) : !editing && !value && previewNo ? (
        <p className="text-[11px] text-slate-400 mt-1">
          Auto-issue as{" "}
          <button type="button" onClick={() => onChange(previewNo)} className="font-mono text-indigo-600 hover:underline">
            {previewNo}
          </button>
          {previewNote && <span className="ml-1">· {previewNote}</span>}
        </p>
      ) : !editing && !previewNo && waitingFor ? (
        <p className="text-[11px] text-slate-400 mt-1">Pick a {waitingFor} to preview the number, or type your own.</p>
      ) : null}
    </div>
  );
}
