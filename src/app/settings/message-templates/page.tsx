"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ModalPortal from "@/components/ModalPortal";
import { confirmDialog, alertDialog } from "@/components/Dialog";
import { Plus, Mail, MessageCircle, Edit2, Trash2, X, Paperclip, Lock } from "lucide-react";
import { renderTemplate } from "@/lib/merge";
import {
  SAMPLE_CONTEXT,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CHANNELS,
  TEMPLATE_ENTITY_TYPES,
  TEMPLATE_ATTACH_KINDS,
} from "@/lib/message-templates";

interface Template {
  id: string;
  name: string;
  category: string;
  channel: string;
  entityType: string;
  toExpr: string;
  ccExpr: string;
  bccExpr: string;
  subject: string;
  body: string;
  attachPdf: boolean;
  attachKind: string;
  isActive: boolean;
  isSystem: boolean;
  version: number;
}

type Draft = Partial<Template>;

const MERGE_VARS = [
  "company.name", "client.name", "client.email", "vendor.name",
  "invoice.number", "invoice.total", "invoice.balance", "invoice.dueDate",
  "quotation.number", "quotation.total", "po.number", "amount", "link",
];

const emptyDraft: Draft = {
  name: "", category: "General", channel: "EMAIL", entityType: "",
  toExpr: "", ccExpr: "", bccExpr: "", subject: "", body: "",
  attachPdf: false, attachKind: "none", isActive: true,
};

const channelIcon = (c: string) =>
  c === "WHATSAPP" ? <MessageCircle size={13} /> : c === "BOTH" ? <><Mail size={13} /><MessageCircle size={13} /></> : <Mail size={13} />;

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const activeField = useRef<"subject" | "body">("body");

  async function load() {
    setLoading(true);
    try {
      const { templates } = await apiGet<{ templates: Template[] }>("/api/settings/message-templates");
      setTemplates(templates);
    } catch (e) {
      await notify(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Template[]> = {};
    for (const t of templates) (g[t.category] ??= []).push(t);
    return g;
  }, [templates]);

  async function save() {
    if (!draft) return;
    if (!draft.name?.trim()) { await notify("Template name is required"); return; }
    setSaving(true);
    try {
      if (draft.id) {
        await apiPut(`/api/settings/message-templates/${draft.id}`, draft);
      } else {
        await apiPost("/api/settings/message-templates", draft);
      }
      setDraft(null);
      await load();
    } catch (e) {
      await notify(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    if (!(await confirmDialog({ title: "Delete template?", message: `"${t.name}" will be permanently removed. This can't be undone.` }))) return;
    try {
      await apiDelete(`/api/settings/message-templates/${t.id}`);
      await load();
    } catch (e) {
      await notify(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function toggleActive(t: Template) {
    try {
      await apiPut(`/api/settings/message-templates/${t.id}`, { isActive: !t.isActive });
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, isActive: !x.isActive } : x));
    } catch (e) {
      await notify(e instanceof Error ? e.message : "Failed to update");
    }
  }

  function insertVar(v: string) {
    if (!draft) return;
    const field = activeField.current;
    setDraft({ ...draft, [field]: `${(draft[field] as string) ?? ""}{{${v}}}` });
  }

  const previewSubject = draft ? renderTemplate(draft.subject ?? "", SAMPLE_CONTEXT, { escape: false }) : "";
  const previewBody = draft ? renderTemplate(draft.body ?? "", SAMPLE_CONTEXT) : "";

  return (
    <div>
      <PageHeader
        title="Message Templates"
        subtitle="Reusable email & WhatsApp templates for sending documents, reminders and follow-ups."
        action={
          <button
            onClick={() => setDraft({ ...emptyDraft })}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> New template
          </button>
        }
      />

      {loading ? (
        <p className="px-6 py-10 text-sm text-slate-500">Loading templates…</p>
      ) : (
        <div className="px-6 pb-12 space-y-8">
          {TEMPLATE_CATEGORIES.filter((c) => grouped[c]?.length).map((cat) => (
            <section key={cat}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{cat}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[cat].map((t) => (
                  <div key={t.id} className={`rounded-xl border p-4 ${t.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-800">
                          <span className="truncate">{t.name}</span>
                          {t.isSystem && <Lock size={12} className="shrink-0 text-slate-400" />}
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{t.subject || "(no subject)"}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                        {channelIcon(t.channel)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
                        {t.attachPdf && <span className="inline-flex items-center gap-1"><Paperclip size={11} /> PDF</span>}
                        <button onClick={() => toggleActive(t)} className={`font-semibold ${t.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                          {t.isActive ? "Active" : "Off"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDraft({ ...t })} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Edit"><Edit2 size={14} /></button>
                        {!t.isSystem && (
                          <button onClick={() => remove(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {draft && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
            <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-[17px] font-bold text-slate-800">{draft.id ? "Edit template" : "New template"}</h2>
                <button onClick={() => setDraft(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-2">
                {/* ── Editor ── */}
                <div className="space-y-3">
                  <Field label="Name">
                    <input className={inputCls} value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Invoice — Send" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                      <select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                        {TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Channel">
                      <select className={inputCls} value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>
                        {TEMPLATE_CHANNELS.map((c) => <option key={c} value={c}>{c === "BOTH" ? "Email + WhatsApp" : c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Used for">
                      <select className={inputCls} value={draft.entityType} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })}>
                        {TEMPLATE_ENTITY_TYPES.map((c) => <option key={c} value={c}>{c || "Any"}</option>)}
                      </select>
                    </Field>
                    <Field label="Attach PDF">
                      <select className={inputCls} value={draft.attachKind} onChange={(e) => setDraft({ ...draft, attachKind: e.target.value, attachPdf: e.target.value !== "none" })}>
                        {TEMPLATE_ATTACH_KINDS.map((c) => <option key={c} value={c}>{c === "none" ? "No attachment" : c}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="To (optional — defaults to the record's contact)">
                    <input className={inputCls} value={draft.toExpr ?? ""} onChange={(e) => setDraft({ ...draft, toExpr: e.target.value })} placeholder="{{client.email}}" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CC"><input className={inputCls} value={draft.ccExpr ?? ""} onChange={(e) => setDraft({ ...draft, ccExpr: e.target.value })} /></Field>
                    <Field label="BCC"><input className={inputCls} value={draft.bccExpr ?? ""} onChange={(e) => setDraft({ ...draft, bccExpr: e.target.value })} /></Field>
                  </div>
                  <Field label="Subject (email)">
                    <input className={inputCls} value={draft.subject ?? ""} onFocus={() => (activeField.current = "subject")} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Invoice {{invoice.number}} from {{company.name}}" />
                  </Field>
                  <Field label="Body (HTML)">
                    <textarea className={`${inputCls} h-40 font-mono text-[12.5px]`} value={draft.body ?? ""} onFocus={() => (activeField.current = "body")} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                  </Field>
                  <div>
                    <p className="mb-1.5 text-[11.5px] font-semibold text-slate-500">Insert a variable (into the last-focused field):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MERGE_VARS.map((v) => (
                        <button key={v} onClick={() => insertVar(v)} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-indigo-100 hover:text-indigo-700">{`{{${v}}}`}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Live preview ── */}
                <div className="space-y-3">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">Live preview (sample data)</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-400">Subject</p>
                    <p className="mb-3 text-[14px] font-semibold text-slate-800">{previewSubject || "(no subject)"}</p>
                    <p className="text-[11px] text-slate-400">Body</p>
                    <div className="prose prose-sm mt-1 max-w-none rounded-lg bg-white p-3 text-[13.5px] text-slate-700" dangerouslySetInnerHTML={{ __html: previewBody || "<p class='text-slate-400'>(empty)</p>" }} />
                  </div>
                  <p className="text-[11.5px] text-slate-400">Values shown are sample data. Real sends use the actual record. User-entered values are HTML-escaped automatically.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
                <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? "Saving…" : "Save template"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

const notify = (msg: string) => alertDialog({ title: msg });

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
