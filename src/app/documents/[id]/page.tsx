"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { FileText, Download, Trash2, ArrowLeft, Calendar, User, Tag, HardDrive } from "lucide-react";

interface Doc {
  id: string; code: string; name: string; fileUrl: string; format: string; mimeType?: string;
  sizeBytes: number; category: string; description: string; expiresAt: string | null;
  uploadedByName: string; createdAt: string;
}

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export default function DocumentViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${id}`).then((r) => r.json()).then((d) => { setDoc(d.document ?? null); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  async function remove() {
    if (!doc || !confirm(`Delete "${doc.name}"? This permanently removes the file.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); router.push("/documents"); } else toast.error("Delete failed");
  }

  const isImg = doc && (/\.(png|jpe?g|gif|webp|svg)$/i.test(doc.format) || doc.mimeType?.startsWith?.("image/"));
  const isPdf = doc && (doc.format === "pdf" || doc.mimeType === "application/pdf");
  const expiry = doc?.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86_400_000) : null;

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
            <div className="card" style={{ padding: 16 }}>
              <div className="space-y-3">
                {[
                  { icon: Tag, label: "Code", val: doc.code || "—" },
                  { icon: FileText, label: "Type", val: (doc.format || "file").toUpperCase() },
                  { icon: HardDrive, label: "Size", val: fmt(doc.sizeBytes) },
                  { icon: User, label: "Uploaded by", val: doc.uploadedByName || "—" },
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
            <div className="card" style={{ padding: 16 }}>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 mb-2.5"><Download size={15} /> Download</a>
              <button onClick={remove} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 text-red-600 text-[13px] font-semibold hover:bg-red-50"><Trash2 size={15} /> Delete</button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 min-w-0 card" style={{ padding: 0, overflow: "hidden", minHeight: "70vh", background: "#f1f5f9" }}>
            {isImg
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={doc.fileUrl} alt={doc.name} className="max-w-full mx-auto block" />
              : isPdf
                ? <iframe src={doc.fileUrl} title={doc.name} className="w-full" style={{ border: "none", minHeight: "70vh" }} />
                : <div className="h-full flex flex-col items-center justify-center text-center p-10" style={{ minHeight: "70vh" }}><FileText size={40} className="text-slate-300 mb-3" /><div className="text-slate-500 text-sm mb-3">Preview isn&apos;t available for this file type.</div><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold"><Download size={15} /> Download</a></div>}
          </div>
        </div>
      )}
    </div>
  );
}
