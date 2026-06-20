"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ModalPortal from "@/components/ModalPortal";
import {
  Bell, Clock, AlertTriangle, Send, Mail, MessageCircle,
  ChevronDown, ChevronUp, X, Copy, Check, Settings2,
} from "lucide-react";
import Link from "next/link";
import PermissionGate from "@/components/PermissionGate";
import Pagination from "@/components/Pagination";

/* ─── types ──────────────────────────────────────────────────────────── */
interface OverdueInvoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientEmail: string;
  clientPhones: string[];
  totalAmount: number;
  dueDate: string;
  status: string;
  daysOverdue: number;
}

interface ReminderLog {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  clientName: string;
  amount: number;
  type: string;
  sentAt: string;
  sentTo: string;
  status: string;
  notes: string;
}

/* ─── default templates ──────────────────────────────────────────────── */
const DEFAULT_EMAIL_SUBJECT = "Payment Reminder – Invoice {{invoiceNo}}";
const DEFAULT_EMAIL_BODY = `Dear {{clientName}},

This is a friendly reminder that Invoice {{invoiceNo}} for ₹{{amount}} was due on {{dueDate}} and is currently {{daysOverdue}} days overdue.

We kindly request you to process the payment at your earliest convenience.

If you have already made the payment, please disregard this message.

Thank you for your business.

Best regards,
{{companyName}}`;

const DEFAULT_WHATSAPP = `Hi {{clientName}}, this is a payment reminder for Invoice {{invoiceNo}} (₹{{amount}}). It was due on {{dueDate}} and is {{daysOverdue}} days overdue. Please process payment at your earliest convenience. Thank you!`;

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function severityStyle(days: number) {
  if (days >= 30) return { bg: "#FEE2E2", color: "#991B1B", label: "Critical" };
  if (days >= 14) return { bg: "#FEF3C7", color: "#92400E", label: "High" };
  if (days >= 7)  return { bg: "#FFEDD5", color: "#9A3412", label: "Medium" };
  return { bg: "#DBEAFE", color: "#1E40AF", label: "Low" };
}

/* ─── localStorage helpers ───────────────────────────────────────────── */
const LS_KEY = "reminder_templates";
function loadTemplates() {
  try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r); } catch {} return null;
}
function saveTemplates(t: { emailSubject: string; emailBody: string; whatsapp: string }) {
  localStorage.setItem(LS_KEY, JSON.stringify(t));
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function RemindersPage() {
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [history, setHistory] = useState<ReminderLog[]>([]);
  const [histPage, setHistPage] = useState(1);
  const HIST_PER_PAGE = 20;
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  /* templates */
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [whatsappTpl, setWhatsappTpl] = useState(DEFAULT_WHATSAPP);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  /* compose modal */
  const [composeInv, setComposeInv] = useState<OverdueInvoice | null>(null);
  const [composeMode, setComposeMode] = useState<"email" | "whatsapp">("email");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [copied, setCopied] = useState(false);

  /* expanded history per invoice */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overdue" | "history">("overdue");

  useEffect(() => {
    loadAll();
    const saved = loadTemplates();
    if (saved) {
      setEmailSubject(saved.emailSubject || DEFAULT_EMAIL_SUBJECT);
      setEmailBody(saved.emailBody || DEFAULT_EMAIL_BODY);
      setWhatsappTpl(saved.whatsapp || DEFAULT_WHATSAPP);
    }
  }, []);

  async function loadAll() {
    setLoading(true);
    const [inv, rem, settings] = await Promise.all([
      apiGet<OverdueInvoice[]>("/api/reminders/overdue"),
      apiGet<ReminderLog[]>("/api/reminders"),
      apiGet<{ businessName?: string }>("/api/settings"),
    ]);
    if (inv) setInvoices(inv);
    if (rem) setHistory(rem);
    if (settings?.businessName) setCompanyName(settings.businessName);
    setLoading(false);
  }

  function getVars(inv: OverdueInvoice) {
    return {
      invoiceNo: inv.invoiceNo, clientName: inv.clientName,
      amount: fmt(inv.totalAmount), dueDate: fmtDate(inv.dueDate),
      daysOverdue: String(inv.daysOverdue), companyName,
    };
  }

  function openCompose(inv: OverdueInvoice, mode: "email" | "whatsapp") {
    const vars = getVars(inv);
    setComposeInv(inv);
    setComposeMode(mode);
    setComposeSubject(fillTemplate(emailSubject, vars));
    setComposeBody(fillTemplate(mode === "email" ? emailBody : whatsappTpl, vars));
    setCopied(false);
  }

  async function sendCompose() {
    if (!composeInv) return;
    if (composeMode === "email") {
      window.open(`mailto:${composeInv.clientEmail}?subject=${encodeURIComponent(composeSubject)}&body=${encodeURIComponent(composeBody)}`, "_blank");
    } else {
      const phone = composeInv.clientPhones[0]?.replace(/\D/g, "") || "";
      window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(composeBody)}` : `https://wa.me/?text=${encodeURIComponent(composeBody)}`, "_blank");
    }
    await apiPost("/api/reminders", {
      invoiceId: composeInv.id,
      type: composeMode,
      sentTo: composeMode === "email" ? composeInv.clientEmail : (composeInv.clientPhones[0] || "unknown"),
      notes: composeMode === "email" ? composeSubject : composeBody.substring(0, 120),
    });
    setComposeInv(null);
    loadAll();
  }

  function handleSaveTemplates() {
    saveTemplates({ emailSubject, emailBody, whatsapp: whatsappTpl });
    setShowTemplateModal(false);
  }

  const totalOverdue = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const criticalCount = invoices.filter(i => i.daysOverdue >= 30).length;

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Payment Reminders"
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Reminders" }]}
        action={
          <button onClick={() => setShowTemplateModal(true)} className="btn btn-secondary">
            <Settings2 size={14} /> Customize Templates
          </button>
        }
      />

      {/* ─── Urgent Banner ─────────────────────────────────────────── */}
      {!loading && invoices.length > 0 && (
        <div className="card" style={{
          padding: "14px 20px",
          background: criticalCount > 0 ? "linear-gradient(135deg, #FEE2E2, #FECACA)" : "linear-gradient(135deg, #FEF3C7, #FDE68A)",
          border: `1.5px solid ${criticalCount > 0 ? "#FECACA" : "#FDE68A"}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <AlertTriangle size={20} style={{ color: criticalCount > 0 ? "#DC2626" : "#D97706", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: criticalCount > 0 ? "#991B1B" : "#92400E" }}>
            {invoices.length} unpaid invoice{invoices.length !== 1 ? "s" : ""} totalling ₹{fmt(totalOverdue)} need attention
            {criticalCount > 0 && ` — ${criticalCount} critical (30+ days overdue)`}
          </div>
        </div>
      )}
      {!loading && invoices.length === 0 && (
        <div className="card" style={{
          padding: "14px 20px",
          background: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
          border: "1.5px solid #A7F3D0",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Check size={20} style={{ color: "#059669", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#065F46" }}>
            All invoices are paid — no reminders needed!
          </div>
        </div>
      )}

      {/* ─── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overdue Invoices", value: String(invoices.length), icon: <AlertTriangle size={16} className="text-red-600" />, bg: "bg-red-100" },
          { label: "Total Pending", value: `₹${fmt(totalOverdue)}`, icon: <Clock size={16} className="text-amber-600" />, bg: "bg-amber-100" },
          { label: "Reminders Sent", value: String(history.length), icon: <Send size={16} className="text-purple-600" />, bg: "bg-purple-100" },
          { label: "Critical (30+ days)", value: String(criticalCount), icon: <Bell size={16} className="text-red-600" />, bg: "bg-red-100" },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>{c.icon}</div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{c.label}</div>
                <div className="text-[20px] font-bold text-slate-900">{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["overdue", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all cursor-pointer ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "overdue" ? `Overdue Invoices (${invoices.length})` : `Reminder History (${history.length})`}
          </button>
        ))}
      </div>

      {/* ─── Overdue Invoices Tab ──────────────────────────────────── */}
      {tab === "overdue" && (
        <div className="card overflow-hidden w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-[13px] text-slate-400">Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="empty-icon"><Check size={36} color="#D1D5DB" /></div>
                <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No overdue invoices</h3>
                <p className="text-[13px] text-slate-400 mt-1">All payments are up to date</p>
              </div>
            ) : (
              <table className="tbl tbl-cards">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Amount</th>
                    <th className="mob-hide">Due Date</th>
                    <th>Days Overdue</th>
                    <th className="mob-hide tab-hide">Severity</th>
                    <th className="mob-hide tab-hide">Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const sev = severityStyle(inv.daysOverdue);
                    const invHistory = history.filter(h => h.invoiceId === inv.id);
                    const isExpanded = expandedId === inv.id;
                    return (
                      <tr key={inv.id} className="group">
                        <td className="mob-primary">
                          <Link href={`/invoices/view?id=${inv.id}`} className="text-indigo-600 hover:underline font-mono text-[12px] font-semibold">
                            {inv.invoiceNo}
                          </Link>
                        </td>
                        <td className="text-[12px] font-medium" data-label="Client">{inv.clientName}</td>
                        <td className="text-[12px] font-semibold tabular-nums" data-label="Amt">₹{fmt(inv.totalAmount)}</td>
                        <td className="mob-hide text-[12px]">{fmtDate(inv.dueDate)}</td>
                        <td data-label="Overdue">
                          <span className="text-[13px] font-bold tabular-nums" style={{ color: sev.color }}>{inv.daysOverdue} days</span>
                        </td>
                        <td className="mob-hide tab-hide">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: sev.bg, color: sev.color }}>
                            {sev.label}
                          </span>
                        </td>
                        <td className="mob-hide tab-hide text-[11px] text-slate-500">
                          {inv.clientEmail && <div>{inv.clientEmail}</div>}
                          {inv.clientPhones[0] && <div>{inv.clientPhones[0]}</div>}
                        </td>
                        <td className="mob-actions">
                          <div className="flex items-center gap-1.5">
                            <PermissionGate module="reminders" action="create"><button onClick={() => openCompose(inv, "email")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer">
                              <Mail size={12} /> Email
                            </button></PermissionGate>
                            <PermissionGate module="reminders" action="create"><button onClick={() => openCompose(inv, "whatsapp")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white transition-colors cursor-pointer"
                              style={{ background: "#25D366" }}>
                              <MessageCircle size={12} /> WhatsApp
                            </button></PermissionGate>
                            {invHistory.length > 0 && (
                              <button onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
                                {invHistory.length} sent {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                          </div>
                          {isExpanded && invHistory.length > 0 && (
                            <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">
                              {invHistory.map(h => (
                                <div key={h.id} className="flex items-center gap-2 text-[11px] text-slate-500">
                                  {h.type === "email" ? <Mail size={10} /> : h.type === "whatsapp" ? <MessageCircle size={10} /> : <Send size={10} />}
                                  <span className="font-medium">{h.type}</span>
                                  <span>→ {h.sentTo}</span>
                                  <span className="text-slate-300">·</span>
                                  <span>{fmtDate(h.sentAt)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── History Tab ───────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="card overflow-hidden w-full">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-[13px] text-slate-400">Loading…</div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="empty-icon"><Send size={36} color="#D1D5DB" /></div>
                <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No reminders sent yet</h3>
                <p className="text-[13px] text-slate-400 mt-1">Send reminders from the Overdue Invoices tab</p>
              </div>
            ) : (
              <table className="tbl tbl-cards">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Amount</th>
                    <th>Channel</th>
                    <th className="mob-hide">Sent To</th>
                    <th className="mob-hide">Sent At</th>
                    <th className="mob-hide tab-hide">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice((histPage - 1) * HIST_PER_PAGE, histPage * HIST_PER_PAGE).map(r => (
                    <tr key={r.id}>
                      <td className="mob-primary">
                        <Link href={`/invoices/view?id=${r.invoiceId}`} className="text-indigo-600 hover:underline font-mono text-[12px]">
                          {r.invoiceNo}
                        </Link>
                      </td>
                      <td className="text-[12px]" data-label="Client">{r.clientName}</td>
                      <td className="text-[12px] font-semibold tabular-nums" data-label="Amt">₹{fmt(r.amount)}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.type === "email" ? "bg-indigo-50 text-indigo-600" : r.type === "whatsapp" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {r.type === "email" ? <Mail size={10} /> : r.type === "whatsapp" ? <MessageCircle size={10} /> : <Send size={10} />}
                          {r.type}
                        </span>
                      </td>
                      <td className="mob-hide text-[12px]">{r.sentTo}</td>
                      <td className="mob-hide text-[12px]">{fmtDate(r.sentAt)}</td>
                      <td className="mob-hide tab-hide text-[12px] text-slate-500 max-w-[200px] truncate">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {history.length > HIST_PER_PAGE && (
              <div className="mt-4">
                <Pagination
                  page={histPage}
                  totalPages={Math.ceil(history.length / HIST_PER_PAGE)}
                  onPageChange={setHistPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Compose Modal ─────────────────────────────────────────── */}
      {composeInv && (
        <ModalPortal>
          <div className="modal-bg" onClick={() => setComposeInv(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  {composeMode === "email"
                    ? <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><Mail size={15} className="text-indigo-600" /></div>
                    : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#D1FAE5" }}><MessageCircle size={15} style={{ color: "#25D366" }} /></div>}
                  <div>
                    <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                      {composeMode === "email" ? "Send Email Reminder" : "Send WhatsApp Reminder"}
                    </h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      {composeInv.invoiceNo} · {composeInv.clientName} · ₹{fmt(composeInv.totalAmount)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setComposeInv(null)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
              </div>

              {/* Body */}
              <div className="px-5 sm:px-7 py-5 space-y-4">
                {/* Info strip */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                      {composeMode === "email" ? "Recipient Email" : "Recipient Phone"}
                    </div>
                    <div className="text-[13px] font-semibold text-slate-900 mt-0.5">
                      {composeMode === "email" ? (composeInv.clientEmail || "No email on file") : (composeInv.clientPhones[0] || "No phone on file")}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-[11px] text-red-400 font-medium uppercase tracking-wide">Overdue</div>
                    <div className="text-[13px] font-bold text-red-600 mt-0.5">{composeInv.daysOverdue} days</div>
                  </div>
                </div>

                {/* Subject (email only) */}
                {composeMode === "email" && (
                  <div>
                    <label className="lbl">Subject</label>
                    <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className="inp w-full" />
                  </div>
                )}

                {/* Message */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="lbl" style={{ marginBottom: 0 }}>Message</label>
                    <button onClick={() => { navigator.clipboard.writeText(composeBody); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">
                      {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)}
                    className="inp w-full" rows={composeMode === "email" ? 10 : 5}
                    style={{ lineHeight: 1.6, resize: "vertical" }} />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 sm:px-7 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => setComposeInv(null)} className="btn btn-secondary">Cancel</button>
                <button onClick={sendCompose}
                  className="btn text-white"
                  style={{ background: composeMode === "email" ? "#4F46E5" : "#25D366" }}>
                  {composeMode === "email" ? <><Mail size={14} /> Open in Mail Client</> : <><MessageCircle size={14} /> Open in WhatsApp</>}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ─── Template Customization Modal ──────────────────────────── */}
      {showTemplateModal && (
        <ModalPortal>
          <div className="modal-bg" onClick={() => setShowTemplateModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Customize Reminder Templates</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">Edit email and WhatsApp message templates for payment reminders</p>
                </div>
                <button onClick={() => setShowTemplateModal(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
              </div>

              {/* Body */}
              <div className="px-5 sm:px-7 py-5 space-y-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {/* Variables reference */}
                <div className="bg-sky-50 rounded-lg p-3">
                  <div className="text-[11px] text-sky-700 font-semibold mb-1.5">Available Variables</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["clientName", "invoiceNo", "amount", "dueDate", "daysOverdue", "companyName"].map(v => (
                      <code key={v} className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[11px] font-mono">{`{{${v}}}`}</code>
                    ))}
                  </div>
                </div>

                {/* Email Subject */}
                <div>
                  <label className="lbl">Email Subject Template</label>
                  <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="inp w-full" />
                </div>

                {/* Email Body */}
                <div>
                  <label className="lbl">Email Body Template</label>
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                    className="inp w-full" rows={10}
                    style={{ lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }} />
                </div>

                {/* WhatsApp Template */}
                <div>
                  <label className="lbl">WhatsApp Message Template</label>
                  <textarea value={whatsappTpl} onChange={e => setWhatsappTpl(e.target.value)}
                    className="inp w-full" rows={4}
                    style={{ lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }} />
                </div>

                {/* Reset */}
                <button onClick={() => { setEmailSubject(DEFAULT_EMAIL_SUBJECT); setEmailBody(DEFAULT_EMAIL_BODY); setWhatsappTpl(DEFAULT_WHATSAPP); }}
                  className="text-[12px] text-slate-400 hover:text-red-500 cursor-pointer transition-colors">
                  Reset to defaults
                </button>
              </div>

              {/* Footer */}
              <div className="px-5 sm:px-7 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => setShowTemplateModal(false)} className="btn btn-secondary">Cancel</button>
                <button onClick={handleSaveTemplates} className="btn btn-primary">Save Templates</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
