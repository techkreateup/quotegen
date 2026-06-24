"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import SignaturePad from "@/components/SignaturePad";
import { Library, Users, Building2, PenLine, Check } from "lucide-react";

export interface PickedSignature {
  signatureId: string | null;
  name: string;
  role: string;
  imageUrl: string;
  source: string; // library | employee | settings | manual
}

interface Option {
  id: string;
  signatureId: string | null;
  name: string;
  role: string;
  imageUrl: string;
  source: string;
}

interface Props {
  onPick: (sig: PickedSignature) => void;
  // Optional: when set, highlights the currently-picked option id.
  selectedId?: string | null;
}

type Tab = "library" | "employee" | "settings" | "draw";

const TABS: { key: Tab; label: string; icon: typeof Library; sources: string[] }[] = [
  { key: "library", label: "Library", icon: Library, sources: ["library"] },
  { key: "employee", label: "Employees", icon: Users, sources: ["employee"] },
  { key: "settings", label: "Company", icon: Building2, sources: ["settings"] },
  { key: "draw", label: "Draw / Upload", icon: PenLine, sources: [] },
];

// Unified signature chooser: pick a saved sign (library / employee / company
// settings) or draw-and-upload a fresh one. Reused by the template editor,
// approvals, and the document detail page.
export default function SignaturePicker({ onPick, selectedId }: Props) {
  const [tab, setTab] = useState<Tab>("library");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  // Draw tab state
  const [drawn, setDrawn] = useState("");
  const [drawName, setDrawName] = useState("");
  const [drawRole, setDrawRole] = useState("");

  useEffect(() => {
    apiGet<{ options: Option[] }>("/api/signatures")
      .then((d) => setOptions(d.options || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = options.filter((o) => TABS.find((t) => t.key === tab)?.sources.includes(o.source));

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12.5px] font-semibold ${tab === t.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "draw" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={drawName} onChange={(e) => setDrawName(e.target.value)} placeholder="Signer name" className="inp" style={{ height: 36, fontSize: 13 }} />
            <input value={drawRole} onChange={(e) => setDrawRole(e.target.value)} placeholder="Role / title (e.g. CEO)" className="inp" style={{ height: 36, fontSize: 13 }} />
          </div>
          <SignaturePad value={drawn} onChange={setDrawn} label="Draw or upload signature" />
          <button
            type="button"
            disabled={!drawn}
            onClick={() => onPick({ signatureId: null, name: drawName.trim(), role: drawRole.trim(), imageUrl: drawn, source: "manual" })}
            className="btn btn-primary btn-sm disabled:opacity-40"
          >
            <Check size={14} /> Use this signature
          </button>
        </div>
      ) : loading ? (
        <div className="text-slate-400 text-sm py-6 text-center">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-slate-400 text-sm py-6 text-center">No saved signatures here yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {visible.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick({ signatureId: o.signatureId, name: o.name, role: o.role, imageUrl: o.imageUrl, source: o.source })}
              className={`border rounded-xl p-2.5 text-left hover:border-indigo-400 transition-colors ${selectedId === o.id ? "border-indigo-500 ring-1 ring-indigo-300" : "border-slate-200"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt="" className="h-12 w-full object-contain mb-1.5" />
              <div className="text-[12.5px] font-semibold text-slate-800 truncate">{o.name || "—"}</div>
              {o.role && <div className="text-[11px] text-slate-500 truncate">{o.role}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
