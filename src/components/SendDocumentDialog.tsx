"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import ModalPortal from "@/components/ModalPortal";
import { pdfBase64FromElement } from "@/lib/pdf";
import { htmlToText, textToHtml } from "@/lib/merge";
import { Mail, MessageCircle, X, Paperclip, Send, Check, Eye, Pencil } from "lucide-react";

interface TemplateLite {
  id: string; name: string; category: string; channel: string;
  attachPdf: boolean; attachKind: string; entityType: string;
}
interface LogLite {
  id: string; channel: string; toAddr: string; subject: string;
  status: string; sentAt: string; sentByName: string;
}

export default function SendDocumentDialog({
  entityType, entityId, pdfElementId, defaultChannel = "EMAIL", onClose,
}: {
  entityType: string;
  entityId: string;
  pdfElementId?: string;
  defaultChannel?: "EMAIL" | "WHATSAPP";
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [logs, setLogs] = useState<LogLite[]>([]);
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">(defaultChannel);
  const [templateId, setTemplateId] = useState<string>("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [attach, setAttach] = useState(false);
  const [fromName, setFromName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editMsg, setEditMsg] = useState(false);

  // Load templates + recent history on open.
  useEffect(() => {
    (async () => {
      try {
        const [{ templates }, { logs }] = await Promise.all([
          apiGet<{ templates: TemplateLite[] }>(`/api/messages/templates?entityType=${entityType}`),
          apiGet<{ logs: LogLite[] }>(`/api/messages/send?entityType=${entityType}&entityId=${entityId}`),
        ]);
        setTemplates(templates);
        setLogs(logs);
        // Auto-select the first template matching the default channel.
        const first = templates.find((t) => t.channel === defaultChannel || t.channel === "BOTH") || templates[0];
        if (first) { setTemplateId(first.id); setAttach(first.attachPdf && !!pdfElementId); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch a server-rendered preview (real merged values) whenever the template
  // or channel changes, populating the editable fields.
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const r = await apiPost<{ to: string; cc: string[]; bcc: string[]; subject: string; body: string; fromName?: string }>(
          "/api/messages/send",
          { entityType, entityId, templateId, channel, preview: true }
        );
        setTo(r.to || "");
        setCc((r.cc || []).join(", "));
        setBcc((r.bcc || []).join(", "));
        setSubject(r.subject || "");
        // Show a friendly plain-text version in the editor (no HTML tags); it's
        // converted back to formatted HTML on send.
        setBodyText(htmlToText(r.body || ""));
        setFromName(r.fromName || "");
      } catch {
        /* preview is best-effort */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, channel]);

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      let attachment: { filename: string; content: string } | undefined;
      if (attach && pdfElementId && channel === "EMAIL") {
        try {
          const content = await pdfBase64FromElement(pdfElementId);
          // Backstop against the serverless body limit (~4.5MB). If the PDF is
          // still too big, send without it rather than failing with a 413.
          if (content && content.length > 3_500_000) {
            setError("The PDF is too large to attach — sending with a download link instead.");
          } else if (content) {
            attachment = { filename: `${entityType}-${entityId}.pdf`, content };
          } else {
            setError("Couldn't generate the PDF to attach. Sending without it…");
          }
        } catch {
          setError("Couldn't generate the PDF to attach. Sending without it…");
        }
      }
      const { result } = await apiPost<{ result: { ok: boolean; status: string; reason?: string } }>(
        "/api/messages/send",
        { entityType, entityId, templateId, channel, to, cc, bcc, subject, body: textToHtml(bodyText), attachment }
      );
      if (result.status === "failed") {
        setError(result.reason || "Send failed. Check the recipient and try again.");
      } else if (result.status === "skipped") {
        setError(result.reason === "no recipient" ? "No recipient — add an email/phone." : "Already sent.");
      } else {
        setDone(channel === "EMAIL" ? `Email sent to ${to}` : `WhatsApp sent to ${to}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const channelTemplates = templates.filter((t) => t.channel === channel || t.channel === "BOTH");

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
        <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-slate-800"><Send size={17} /> Send / Share</h2>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>

          {loading ? (
            <p className="px-6 py-10 text-sm text-slate-500">Loading…</p>
          ) : done ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={24} /></div>
              <p className="text-[15px] font-semibold text-slate-800">{done}</p>
              <button onClick={onClose} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {/* Channel */}
              <div className="flex gap-2">
                {(["EMAIL", "WHATSAPP"] as const).map((c) => (
                  <button key={c} onClick={() => setChannel(c)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${channel === c ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
                    {c === "EMAIL" ? <Mail size={14} /> : <MessageCircle size={14} />} {c === "EMAIL" ? "Email" : "WhatsApp"}
                  </button>
                ))}
              </div>

              {channel === "EMAIL" && fromName && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  Sending as <span className="font-semibold text-slate-700">{fromName}</span> · replies come back to you (you&apos;re auto-CC&apos;d)
                </div>
              )}

              {/* Template */}
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-600">Template</span>
                <select className={inputCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {channelTemplates.length === 0 && <option value="">No template — write below</option>}
                  {channelTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-600">To</span>
                <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}
                  placeholder={channel === "EMAIL" ? "name@company.com" : "+91 98xxxxxxx"} />
              </label>

              {channel === "EMAIL" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">CC</span><input className={inputCls} value={cc} onChange={(e) => setCc(e.target.value)} /></label>
                    <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">BCC</span><input className={inputCls} value={bcc} onChange={(e) => setBcc(e.target.value)} /></label>
                  </div>
                  <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Subject</span><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
                </>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-600">Message</span>
                  <button type="button" onClick={() => setEditMsg((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700">
                    {editMsg ? <><Eye size={12} /> Preview</> : <><Pencil size={12} /> Edit text</>}
                  </button>
                </div>
                {editMsg ? (
                  <textarea
                    className={`${inputCls} h-44`}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Type your message…"
                  />
                ) : (
                  <div
                    className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-slate-700"
                    dangerouslySetInnerHTML={{ __html: textToHtml(bodyText) || "<span class='text-slate-400'>No message</span>" }}
                  />
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  {editMsg ? "Plain text — links become clickable, blank lines start a new paragraph." : "This is how your message will look. Your logo & company details are added automatically."}
                </p>
              </div>

              {channel === "EMAIL" && pdfElementId && (
                <label className="flex items-center gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                  <Paperclip size={13} /> Attach PDF
                </label>
              )}

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}

              {logs.length > 0 && (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent</p>
                  {logs.slice(0, 3).map((l) => (
                    <p key={l.id} className="mt-1 text-[12px] text-slate-500">
                      {l.channel === "EMAIL" ? "✉️" : "💬"} {l.toAddr || "—"} · {l.status} · {new Date(l.sentAt).toLocaleString("en-IN")}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={handleSend} disabled={sending || !to}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Send size={14} /> {sending ? "Sending…" : `Send ${channel === "EMAIL" ? "email" : "WhatsApp"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
