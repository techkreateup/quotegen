"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import SignaturePicker, { type PickedSignature } from "@/components/SignaturePicker";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { FileText, Download, Trash2, ArrowLeft, Calendar, User, Tag, HardDrive, Send, PenLine, Link2, X, Plus } from "lucide-react";

interface Doc {
  id: string; code: string; name: string; fileUrl: string; format: string; mimeType?: string;
  sizeBytes: number; category: string; description: string; expiresAt: string | null;
  uploadedByName: string; createdByRole?: string; status: string; createdAt: string;
  employeeId: string | null; clientId: string | null; projectId: string | null;
}
interface DocSig { id: string; signerName: string; signerRole: string; imageUrl: string; source: string; appliedByName: string; appliedAt: string; }
interface Links { employee: { id: string; label: string } | null; client: { id: string; label: string } | null; project: { id: string; label: string } | null; }
interface EntOpt { id: string; label: string }

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569", label: "Draft" },
  pending_approval: { bg: "#fef3c7", fg: "#b45309", label: "Pending approval" },
  approved: { bg: "#dcfce7", fg: "#15803d", label: "Approved" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c", label: "Rejected" },
};

export default function DocumentViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [links, setLinks] = useState<Links | null>(null);
  const [signatures, setSignatures] = useState<DocSig[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [editLinks, setEditLinks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<{ employees: EntOpt[]; clients: EntOpt[]; projects: EntOpt[] }>({ employees: [], clients: [], projects: [] });

  const load = useCallback(() => {
    fetch(`/api/documents/${id}`).then((r) => r.json()).then((d) => {
      setDoc(d.document ?? null); setLinks(d.links ?? null); setSignatures(d.signatures ?? []); setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function loadOpts() {
    if (opts.employees.length || opts.clients.length || opts.projects.length) return;
    try {
      const [e, c, p] = await Promise.all([
        apiGet<{ id: string; name: string }[]>("/api/employees").catch(() => []),
        apiGet<{ id: string; businessName: string }[]>("/api/clients").catch(() => []),
        apiGet<{ id: string; title: string }[]>("/api/projects").catch(() => []),
      ]);
      setOpts({
        employees: (Array.isArray(e) ? e : []).map((x) => ({ id: x.id, label: x.name })),
        clients: (Array.isArray(c) ? c : []).map((x) => ({ id: x.id, label: x.businessName })),
        projects: (Array.isArray(p) ? p : []).map((x) => ({ id: x.id, label: x.title })),
      });
    } catch { /* ignore */ }
  }

  async function remove() {
    if (!doc) return;
    const ok = await dialog.confirm({ title: "Delete document?", message: `"${doc.name}" will be permanently removed. This can't be undone.`, confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); router.push("/documents"); } else toast.error("Delete failed");
  }

  async function submitForApproval() {
    if (!doc) return;
    setBusy(true);
    try {
      const r = await apiPost<{ triggered: boolean }>(`/api/documents/${doc.id}/submit`, {});
      toast.success(r.triggered ? "Submitted for approval" : "No workflow configured — auto-approved");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  async function addSignature(sig: PickedSignature) {
    if (!doc) return;
    try {
      await apiPost(`/api/documents/${doc.id}/signatures`, { signatureId: sig.signatureId, signerName: sig.name, signerRole: sig.role, imageUrl: sig.imageUrl });
      toast.success("Signature added");
      setPicking(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function saveLink(field: "employeeId" | "clientId" | "projectId", value: string) {
    if (!doc) return;
    try { await apiPut(`/api/documents/${doc.id}`, { [field]: value || null }); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  const isImg = doc && (/\.(png|jpe?g|gif|webp|svg)$/i.test(doc.format) || doc.mimeType?.startsWith?.("image/"));
  const isPdf = doc && (doc.format === "pdf" || doc.mimeType === "application/pdf");
  const expiry = doc?.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const st = doc ? (STATUS_STYLE[doc.status] || STATUS_STYLE.approved) : null;

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title={doc?.name || (loading ? "Loading…" : "Document")} subtitle={doc?.code ? `${doc.code} · ${doc.category}` : ""} breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: doc?.code || "View" }]} />
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>
      </div>

      {!doc && !loading && <div className="card p-10 text-center text-slate-400 text-sm">Document not found.</div>}

      {doc && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Meta */}
          <div className="lg:w-72 shrink-0 space-y-4">
            {/* Status + approval */}
            <div className="card" style={{ padding: 16 }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Status</span>
                {st && <span style={{ background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{st.label}</span>}
              </div>
              {(doc.status === "draft" || doc.status === "approved" || doc.status === "rejected") && (
                <button onClick={submitForApproval} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-amber-500 text-white text-[12.5px] font-semibold hover:bg-amber-600 disabled:opacity-50"><Send size={14} /> Submit for approval</button>
              )}
              {doc.status === "pending_approval" && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Awaiting approver. See the <Link href="/approvals" className="text-indigo-600 font-semibold">Approvals</Link> queue.</p>}
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="space-y-3">
                {[
                  { icon: Tag, label: "Code", val: doc.code || "—" },
                  { icon: FileText, label: "Type", val: (doc.format || "file").toUpperCase() },
                  { icon: HardDrive, label: "Size", val: fmt(doc.sizeBytes) },
                  { icon: User, label: "Uploaded by", val: doc.uploadedByName || "—" },
                  { icon: User, label: "Role", val: doc.createdByRole || "—" },
                  { icon: Calendar, label: "Added", val: new Date(doc.createdAt).toLocaleDateString() },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2.5">
                    <m.icon size={15} className="text-slate-400 shrink-0" />
                    <span style={{ fontSize: 12, color: "var(--text-3)", width: 80 }}>{m.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }} className="truncate">{m.val}</span>
                  </div>
                ))}
                {expiry !== null && (
                  <div className="flex items-center gap-2.5">
                    <Calendar size={15} className="text-slate-400 shrink-0" />
                    <span style={{ fontSize: 12, color: "var(--text-3)", width: 80 }}>Expiry</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: expiry < 0 ? "#dc2626" : expiry <= 30 ? "#b45309" : "#059669" }}>{expiry < 0 ? "Expired" : `${expiry} days left`}</span>
                  </div>
                )}
              </div>
              {doc.description && <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef0f5" }}>{doc.description}</p>}
            </div>

            {/* Linked entities */}
            <div className="card" style={{ padding: 16 }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}><Link2 size={14} /> Linked to</span>
                <button onClick={() => { setEditLinks((v) => !v); loadOpts(); }} className="text-[12px] font-semibold text-indigo-600">{editLinks ? "Done" : "Edit"}</button>
              </div>
              {!editLinks ? (
                <div className="space-y-1.5">
                  {links?.employee && <Link href={`/employees/${links.employee.id}`} className="block text-[12.5px] text-indigo-600 font-medium">👤 {links.employee.label}</Link>}
                  {links?.client && <Link href={`/clients/${links.client.id}`} className="block text-[12.5px] text-indigo-600 font-medium">🏢 {links.client.label}</Link>}
                  {links?.project && <Link href={`/projects/${links.project.id}`} className="block text-[12.5px] text-indigo-600 font-medium">📁 {links.project.label}</Link>}
                  {!links?.employee && !links?.client && !links?.project && <p style={{ fontSize: 12, color: "var(--text-4)" }}>Not linked to any record.</p>}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {([
                    { f: "employeeId" as const, label: "Employee", list: opts.employees, cur: doc.employeeId },
                    { f: "clientId" as const, label: "Client", list: opts.clients, cur: doc.clientId },
                    { f: "projectId" as const, label: "Project", list: opts.projects, cur: doc.projectId },
                  ]).map((row) => (
                    <div key={row.f}>
                      <label className="lbl" style={{ fontSize: 11 }}>{row.label}</label>
                      <select value={row.cur || ""} onChange={(e) => saveLink(row.f, e.target.value)} className="inp" style={{ height: 34, fontSize: 12.5 }}>
                        <option value="">— None —</option>
                        {row.list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 16 }}>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 mb-2.5"><Download size={15} /> Download</a>
              <button onClick={remove} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 text-red-600 text-[13px] font-semibold hover:bg-red-50"><Trash2 size={15} /> Delete</button>
            </div>
          </div>

          {/* Preview + signatures */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Signatures */}
            <div className="card" style={{ padding: 16 }}>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}><PenLine size={15} /> Signatures ({signatures.length})</span>
                <button onClick={() => setPicking((v) => !v)} className="btn btn-outline btn-sm">{picking ? <><X size={13} /> Close</> : <><Plus size={13} /> Add signature</>}</button>
              </div>
              {picking && <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50/60"><SignaturePicker onPick={addSignature} /></div>}
              {signatures.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-4)" }}>No signatures applied yet.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {signatures.map((s) => (
                    <div key={s.id} className="text-center" style={{ minWidth: 150 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt="" className="h-12 object-contain mx-auto mb-1" />
                      <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 4, fontSize: 12.5, fontWeight: 700 }}>{s.signerName || "—"}</div>
                      {s.signerRole && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.signerRole}</div>}
                      <div style={{ fontSize: 10.5, color: "var(--text-4)", marginTop: 2 }}>{s.source} · {new Date(s.appliedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="card" style={{ padding: 0, overflow: "auto", minHeight: "70vh", background: "#eef1f6" }}>
              <div style={{ maxWidth: isImg ? 820 : 880, margin: "20px auto", background: "#fff", boxShadow: "0 10px 34px rgba(15,23,42,0.14)", borderRadius: 6, overflow: "hidden" }}>
                {isImg
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={doc.fileUrl} alt={doc.name} className="w-full block" />
                  : isPdf
                    ? <iframe src={`${doc.fileUrl}#toolbar=0&navpanes=0`} title={doc.name} className="w-full" style={{ border: "none", display: "block", height: "70vh" }} />
                    : <div className="flex flex-col items-center justify-center text-center p-12"><FileText size={40} className="text-slate-300 mb-3" /><div className="text-slate-500 text-sm mb-3">Preview isn&apos;t available for this file type.</div><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold"><Download size={15} /> Download</a></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
