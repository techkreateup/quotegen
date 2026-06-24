"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import SignaturePad from "@/components/SignaturePad";
import { useToast } from "@/components/Toast";
import { Plus, Trash2, X } from "lucide-react";

interface LibSig { id: string; name: string; role: string; imageUrl: string; createdByName: string; }

// Org-wide signature library manager, embedded in Settings → Signatures. Each
// entry is role-tagged (e.g. "CEO sign") and reusable across documents,
// templates, and approvals via the shared SignaturePicker.
export default function SignatureLibrary() {
  const toast = useToast();
  const [items, setItems] = useState<LibSig[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [img, setImg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => apiGet<{ library: LibSig[] }>("/api/signatures").then((d) => setItems(d.library || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save() {
    if (!name.trim() || !img) { toast.error("Name and signature image are required"); return; }
    setSaving(true);
    try {
      await apiPost("/api/signatures", { name: name.trim(), role: role.trim(), imageUrl: img });
      toast.success("Signature added");
      setName(""); setRole(""); setImg(""); setAdding(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setSaving(false);
  }

  async function remove(id: string) {
    try { await apiDelete(`/api/signatures/${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="mt-7 pt-6" style={{ borderTop: "1px solid #EEF0F6" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="sec-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>Signature Library</h3>
        <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-outline btn-sm">{adding ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add signature</>}</button>
      </div>
      <p className="text-[12px] text-slate-400 mb-4">Role-tagged signatures (e.g. &ldquo;CEO sign&rdquo;, &ldquo;HR sign&rdquo;) reusable on documents, templates &amp; approvals.</p>

      {adding && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Signer name</label><input value={name} onChange={(e) => setName(e.target.value)} className="inp text-[13px]" placeholder="e.g. Rajesh Kumar" /></div>
            <div><label className="lbl">Role / title</label><input value={role} onChange={(e) => setRole(e.target.value)} className="inp text-[13px]" placeholder="e.g. CEO" /></div>
          </div>
          <SignaturePad value={img} onChange={setImg} label="Draw or upload signature" />
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-sm disabled:opacity-50">{saving ? "Saving…" : "Save to library"}</button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[12.5px] text-slate-400">No saved signatures yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((s) => (
            <div key={s.id} className="border border-slate-200 rounded-xl p-3 text-center relative">
              <button type="button" onClick={() => remove(s.id)} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><Trash2 size={11} /></button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt="" className="h-12 w-full object-contain mb-1.5" />
              <div className="text-[12.5px] font-semibold text-slate-800 truncate">{s.name}</div>
              {s.role && <div className="text-[11px] text-slate-500 truncate">{s.role}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
