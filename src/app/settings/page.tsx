"use client";

import { useEffect, useState } from "react";
import { CompanySettings } from "@/lib/types";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ImageUploader from "@/components/ImageUploader";
import SignatureLibrary from "@/components/SignatureLibrary";
import { Save, Plus, Trash2, Upload, X, Building2, Landmark, Hash, PenTool, Palette, Database, Download, UploadCloud } from "lucide-react";
import { useToast } from "@/components/Toast";

const TABS = [
  { key: "company", label: "Company Info", icon: Building2 },
  { key: "bank", label: "Bank Details", icon: Landmark },
  { key: "numbering", label: "Documents", icon: Hash },
  { key: "signatures", label: "Signatures", icon: PenTool },
  { key: "theme", label: "Appearance", icon: Palette },
  { key: "data", label: "Data Management", icon: Database },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const DEFAULTS: CompanySettings = {
  businessName: "", address: "", city: "", state: "", country: "India", pincode: "",
  gstin: "", pan: "", email: "", phones: [""], bankName: "", accountName: "",
  accountNumber: "", ifsc: "", accountType: "Current", logoUrl: "",
  themeColor: "#7c3aed", contactFooter: "", documentFooter: "This is an electronically generated document, no signature is required.", website: "",
  quotationPrefix: "Q", invoicePrefix: "INV", receiptPrefix: "PR", voucherPrefix: "VCH", creditNotePrefix: "CN",
  nextQuotationNo: 1, nextInvoiceNo: 1, nextReceiptNo: 1, nextVoucherNo: 1, nextEmployeeNo: 1, nextCreditNoteNo: 1,
  proformaPrefix: "PI", nextProformaNo: 1,
  salesOrderPrefix: "SO", nextSalesOrderNo: 1,
  challanPrefix: "DC", nextChallanNo: 1,
  poPrefix: "PO", nextPoNo: 1,
  grnPrefix: "GRN", nextGrnNo: 1,
  debitNotePrefix: "DN", nextDebitNoteNo: 1,
  nonGstInvoicePrefix: "NGI", nextNonGstInvoiceNo: 1, separateGstInvoices: false,
  gstEnabled: true,
  fiscalYearStart: 4,
  checkedByName: "", checkedBySig: "", checkedByRole: "", approvedByName: "", approvedBySig: "", approvedByRole: "", paidByName: "", paidBySig: "", paidByRole: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULTS);
  const [tab, setTab] = useState<TabKey>("company");
  const [backupStatus, setBackupStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasWhiteLabel, setHasWhiteLabel] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiGet<CompanySettings & { hasWhiteLabel?: boolean }>("/api/settings")
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data }));
        setHasWhiteLabel(!!data.hasWhiteLabel);
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPut("/api/settings", settings);
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleFileUpload(field: keyof CompanySettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setSettings({ ...settings, [field]: reader.result as string });
      reader.readAsDataURL(file);
    };
  }

  function updatePhone(i: number, v: string) {
    const phones = [...settings.phones]; phones[i] = v;
    setSettings({ ...settings, phones });
  }

  const set = (field: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setSettings({ ...settings, [field]: e.target.value });

  const setNum = (field: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...settings, [field]: Number(e.target.value) });

  if (pageLoading) {
    return (
      <div className="w-full space-y-6">
        <PageHeader title="Settings" subtitle="Configure your business details" />
        <div className="page-loading">
          <div className="spinner spinner-dark spinner-lg" />
          <span className="page-loading-text">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Settings" subtitle="Configure your business details" />

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: "2px solid #EEF0F6" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-semibold whitespace-nowrap transition-all rounded-t-lg"
                style={{
                  color: active ? "#4F46E5" : "#6B7280",
                  background: active ? "#EEF2FF" : "transparent",
                  borderBottom: active ? "2px solid #4F46E5" : "2px solid transparent",
                  marginBottom: -2,
                }}>
                <Icon size={14} strokeWidth={active ? 2.2 : 1.7} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ─── COMPANY INFO ─── */}
        {tab === "company" && (
          <div className="card p-6 space-y-5">
            <h2 className="sec-title">Business Information</h2>

            {/* Logo — uploaded to UploadThing; URL saved to CompanySettings.logoUrl */}
            <ImageUploader
              endpoint="companyLogo"
              value={settings.logoUrl}
              onChange={(url) => setSettings({ ...settings, logoUrl: url })}
              shape="rect"
              label="Company Logo"
              hint="Appears on invoices, quotes & documents · JPG/PNG/SVG up to 4MB"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="lbl">Business Name *</label>
                <input type="text" required value={settings.businessName} onChange={set("businessName")} className="inp" placeholder="Your company name" />
              </div>
              <div className="sm:col-span-2">
                <label className="lbl">Address</label>
                <textarea value={settings.address} onChange={set("address")} className="inp" rows={2} />
              </div>
              <div><label className="lbl">City</label><input type="text" value={settings.city} onChange={set("city")} className="inp" /></div>
              <div><label className="lbl">State</label><input type="text" value={settings.state} onChange={set("state")} className="inp" /></div>
              <div><label className="lbl">Country</label><input type="text" value={settings.country} onChange={set("country")} className="inp" /></div>
              <div><label className="lbl">Pincode</label><input type="text" value={settings.pincode} onChange={set("pincode")} className="inp" /></div>
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">GST Registered</p>
                    <p className="text-[11px] text-slate-400">Enable if your business is registered under GST. This activates GST columns, returns, and compliance features.</p>
                  </div>
                  <button type="button" onClick={() => setSettings(prev => ({ ...prev, gstEnabled: !prev.gstEnabled }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${settings.gstEnabled ? "bg-indigo-600" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.gstEnabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </div>
              {settings.gstEnabled && <div><label className="lbl">GSTIN</label><input type="text" value={settings.gstin} onChange={set("gstin")} className="inp" placeholder="22AAAAA0000A1Z5" /></div>}
              <div><label className="lbl">PAN</label><input type="text" value={settings.pan} onChange={set("pan")} className="inp" placeholder="AAAAA9999A" /></div>
              <div><label className="lbl">Email</label><input type="email" value={settings.email} onChange={set("email")} className="inp" placeholder="info@company.com" /></div>
              <div><label className="lbl">Website</label><input type="text" value={settings.website} onChange={set("website")} className="inp" placeholder="https://company.com" /></div>
            </div>

            {/* Phone Numbers */}
            <div>
              <label className="lbl">Phone Numbers</label>
              {settings.phones.map((ph, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input type="text" value={ph} onChange={(e) => updatePhone(i, e.target.value)} className="inp flex-1" placeholder="+91 XXXXX XXXXX" />
                  {settings.phones.length > 1 && (
                    <button type="button" onClick={() => setSettings({ ...settings, phones: settings.phones.filter((_, j) => j !== i) })}
                      className="btn btn-ghost btn-icon text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setSettings({ ...settings, phones: [...settings.phones, ""] })}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700 mt-1">
                <Plus size={13} /> Add Phone
              </button>
            </div>
          </div>
        )}

        {/* ─── BANK DETAILS ─── */}
        {tab === "bank" && (
          <div className="card p-6">
            <h2 className="sec-title">Bank Details</h2>
            <p className="text-[12px] text-slate-400 mb-4">These details appear on invoices and quotations for payment reference.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="lbl">Bank Name</label><input type="text" value={settings.bankName} onChange={set("bankName")} className="inp" /></div>
              <div><label className="lbl">Account Name</label><input type="text" value={settings.accountName} onChange={set("accountName")} className="inp" /></div>
              <div><label className="lbl">Account Number</label><input type="text" value={settings.accountNumber} onChange={set("accountNumber")} className="inp" /></div>
              <div><label className="lbl">IFSC Code</label><input type="text" value={settings.ifsc} onChange={set("ifsc")} className="inp" /></div>
              <div>
                <label className="lbl">Account Type</label>
                <select value={settings.accountType} onChange={set("accountType")} className="inp">
                  <option>Current</option><option>Savings</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ─── DOCUMENT SETTINGS ─── */}
        {tab === "numbering" && (
          <div className="card p-6 space-y-6">
            <h2 className="sec-title">Document Settings</h2>
            <p className="text-[12px] text-slate-400 -mt-3 mb-4">Configure prefixes, numbering, footer text, and fiscal year for all documents.</p>

            {/* Numbering Section */}
            <div className="space-y-5">
              <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Numbering & Prefixes</h3>

              {/* Dual-series toggle. Without this ON the server ignores the
                  Non-GST Invoice series entirely (all invoices use nextInvoiceNo).
                  Was previously only in Business Setup wizard → users configured
                  both prefixes here but numbering never actually split. */}
              <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                <input
                  type="checkbox"
                  checked={!!(settings as CompanySettings & { separateGstInvoices?: boolean }).separateGstInvoices}
                  onChange={(e) => setSettings({ ...settings, separateGstInvoices: e.target.checked } as CompanySettings)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">Bill GST & non-GST invoices separately</div>
                  <div className="text-[11.5px] text-slate-500">When on, an invoice for a client without a GSTIN auto-picks the Non-GST series below. Turn off and every invoice uses the single GST series.</div>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { label: "Quotations", prefix: "quotationPrefix" as const, num: "nextQuotationNo" as const },
                  { label: "Proforma Invoices", prefix: "proformaPrefix" as const, num: "nextProformaNo" as const },
                  { label: "Sales Orders", prefix: "salesOrderPrefix" as const, num: "nextSalesOrderNo" as const },
                  { label: "Delivery Challans", prefix: "challanPrefix" as const, num: "nextChallanNo" as const },
                  { label: "Invoices", prefix: "invoicePrefix" as const, num: "nextInvoiceNo" as const },
                  { label: "Non-GST Invoices", prefix: "nonGstInvoicePrefix" as const, num: "nextNonGstInvoiceNo" as const },
                  { label: "Payment Receipts", prefix: "receiptPrefix" as const, num: "nextReceiptNo" as const },
                  { label: "Payment Vouchers", prefix: "voucherPrefix" as const, num: "nextVoucherNo" as const },
                  { label: "Credit Notes", prefix: "creditNotePrefix" as const, num: "nextCreditNoteNo" as const },
                  { label: "Purchase Orders", prefix: "poPrefix" as const, num: "nextPoNo" as const },
                  { label: "Goods Receipts", prefix: "grnPrefix" as const, num: "nextGrnNo" as const },
                  { label: "Debit Notes (buy)", prefix: "debitNotePrefix" as const, num: "nextDebitNoteNo" as const },
                ] as const).map((doc) => (
                  <div key={doc.label} className="p-4 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">{doc.label}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="lbl">Prefix</label><input type="text" value={(settings[doc.prefix] as string) ?? ""} onChange={set(doc.prefix)} className="inp" /></div>
                      <div><label className="lbl">Next No.</label><input type="number" min={1} value={(settings[doc.num] as number) ?? 1} onChange={setNum(doc.num)} className="inp" /></div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 font-mono">Preview: {(settings[doc.prefix] as string) ?? ""}{String((settings[doc.num] as number) ?? 1).padStart(5, "0")}</p>
                  </div>
                ))}

                {/* Employees - fixed prefix */}
                <div className="p-4 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Employees</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="lbl">Prefix</label><input type="text" value="EMP" disabled className="inp bg-slate-50 text-slate-400" /></div>
                    <div><label className="lbl">Next No.</label><input type="number" min={1} value={settings.nextEmployeeNo} onChange={setNum("nextEmployeeNo")} className="inp" /></div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-mono">Preview: EMP{String(settings.nextEmployeeNo).padStart(5, "0")}</p>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: "#EEF0F6" }} />

            {/* Footer & Fiscal Section */}
            <div className="space-y-4">
              <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Document Footer & Fiscal</h3>

              <div>
                <label className="lbl">Contact Footer Text</label>
                <input type="text" value={settings.contactFooter} onChange={set("contactFooter")} className="inp" placeholder="e.g. For any enquiry, reach out via email at info@company.com" />
                <p className="text-[11px] text-slate-400 mt-1">Appears above the disclaimer on all documents.</p>
              </div>

              <div>
                <label className="lbl">Document Footer / Disclaimer</label>
                <input type="text" value={settings.documentFooter} onChange={set("documentFooter")} className="inp" placeholder="e.g. This is an electronically generated document, no signature is required." />
                <p className="text-[11px] text-slate-400 mt-1">Fine print disclaimer at the bottom of all documents.</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: hasWhiteLabel ? "#F8FAFC" : "#FFF7ED", border: `1px solid ${hasWhiteLabel ? "#E2E8F0" : "#FED7AA"}` }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox"
                         disabled={!hasWhiteLabel}
                         checked={!!settings.hideDefaultBrand}
                         onChange={(e) => setSettings({ ...settings, hideDefaultBrand: e.target.checked })}
                         className="mt-0.5 shrink-0" />
                  <span className="flex-1">
                    <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
                      White-label documents
                      {!hasWhiteLabel && (
                        <span className="text-[10px] font-bold uppercase tracking-widest rounded px-1.5 py-0.5"
                              style={{ background: "#FEF3C7", color: "#B45309" }}>Paid plan</span>
                      )}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 mt-0.5">
                      Hide the &ldquo;Made with QuoteGen&rdquo; mark from the footer of your PDFs and shared links.
                      {!hasWhiteLabel && <> Upgrade to a plan with white-label branding to enable this.</>}
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <label className="lbl">Fiscal Year Start Month</label>
                <select value={settings.fiscalYearStart} onChange={(e) => setSettings({ ...settings, fiscalYearStart: Number(e.target.value) })} className="inp" style={{ maxWidth: 220 }}>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="lbl">3-Way Match Tolerance (%)</label>
                <input type="number" min={0} max={100} step={0.5} value={settings.matchTolerancePct ?? 5}
                  onChange={(e) => setSettings({ ...settings, matchTolerancePct: Number(e.target.value) })}
                  className="inp" style={{ maxWidth: 220 }} />
                <p className="text-[11px] text-slate-400 mt-1">Qty/rate variance beyond this % between PO, GRN, and Vendor Bill is flagged for review.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── SIGNATURES ─── */}
        {tab === "signatures" && (
          <div className="card p-6">
            <h2 className="sec-title">Document Signatures</h2>
            <p className="text-[12px] text-slate-400 mb-5">Signatures for payment vouchers. These appear on generated vouchers automatically and are also selectable across documents &amp; approvals. Add a role/title (e.g. &ldquo;CEO&rdquo;) so signers are identified.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {([
                { label: "Checked By", nameField: "checkedByName" as const, sigField: "checkedBySig" as const, roleField: "checkedByRole" as const },
                { label: "Approved By", nameField: "approvedByName" as const, sigField: "approvedBySig" as const, roleField: "approvedByRole" as const },
                { label: "Paid By", nameField: "paidByName" as const, sigField: "paidBySig" as const, roleField: "paidByRole" as const },
              ]).map((sig) => (
                <div key={sig.label} className="p-4 rounded-lg text-center" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">{sig.label}</div>

                  {/* Signature preview */}
                  <div className="flex items-center justify-center mb-3" style={{ height: 80, border: "1px dashed #D1D5E0", borderRadius: 8, background: "#fff" }}>
                    {settings[sig.sigField] ? (
                      <div className="relative">
                        <img src={settings[sig.sigField]} alt={sig.label} style={{ maxHeight: 64, maxWidth: "100%", objectFit: "contain" }} />
                        <button type="button" onClick={() => setSettings({ ...settings, [sig.sigField]: "" })}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-center">
                        <Upload size={16} className="text-indigo-400 mx-auto mb-1" />
                        <span className="text-[11px] text-indigo-500 font-medium">Upload Signature</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload(sig.sigField)} />
                      </label>
                    )}
                  </div>

                  {/* Name */}
                  <label className="lbl text-left">Name</label>
                  <input type="text" value={settings[sig.nameField]} onChange={set(sig.nameField)} className="inp text-[12px]" placeholder="Full name" />

                  {/* Role / title */}
                  <label className="lbl text-left mt-2">Role / Title</label>
                  <input type="text" value={settings[sig.roleField]} onChange={set(sig.roleField)} className="inp text-[12px]" placeholder="e.g. CEO" />
                </div>
              ))}
            </div>

            <SignatureLibrary />

            <div className="mt-5 p-3 rounded-lg" style={{ background: "#FEF9C3", border: "1px solid #FDE68A" }}>
              <p className="text-[11.5px] text-amber-700">
                <strong>Received By</strong> — This signature is automatically captured when the employee acknowledges the voucher. No upload needed.
              </p>
            </div>
          </div>
        )}

        {/* ─── APPEARANCE ─── */}
        {tab === "theme" && (
          <div className="card p-6 space-y-5">
            <h2 className="sec-title">Appearance & Branding</h2>
            <p className="text-[12px] text-slate-400 -mt-3 mb-4">Choose a theme color used on all generated documents (headers, tables, accents).</p>

            <div>
              <label className="lbl">Document Theme Color</label>
              <div className="flex flex-col gap-4 mt-2">
                {/* Color picker + hex input */}
                <div className="flex items-center gap-3">
                  <input type="color" value={settings.themeColor} onChange={set("themeColor")}
                    className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200 p-0.5 hover:border-indigo-300 transition-colors" />
                  <div>
                    <input type="text" value={settings.themeColor} onChange={set("themeColor")} className="inp font-mono" style={{ width: 120 }} placeholder="#000000" />
                    <p className="text-[11px] text-slate-400 mt-1">Enter any hex color code</p>
                  </div>
                </div>

                {/* Quick presets */}
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold mb-2 uppercase tracking-wide">Quick Presets</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { c: "#7c3aed", name: "Purple" }, { c: "#4f46e5", name: "Indigo" }, { c: "#2563eb", name: "Blue" },
                      { c: "#0891b2", name: "Cyan" }, { c: "#059669", name: "Green" }, { c: "#16a34a", name: "Emerald" },
                      { c: "#dc2626", name: "Red" }, { c: "#ea580c", name: "Orange" }, { c: "#d97706", name: "Amber" },
                      { c: "#0f172a", name: "Dark" }, { c: "#475569", name: "Slate" }, { c: "#be185d", name: "Pink" },
                    ].map((p) => (
                      <button key={p.c} type="button" onClick={() => setSettings({ ...settings, themeColor: p.c })}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all hover:scale-105"
                        style={{ background: settings.themeColor === p.c ? "#EEF2FF" : "transparent", border: settings.themeColor === p.c ? "2px solid #4F46E5" : "2px solid transparent" }}>
                        <span className="w-8 h-8 rounded-full shadow-sm" style={{ background: p.c }} />
                        <span className="text-[10px] text-slate-500 font-medium">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                <div className="p-4 rounded-lg" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                  <p className="text-[11px] text-slate-500 font-semibold mb-3 uppercase tracking-wide">Preview</p>
                  <div className="flex items-center gap-4">
                    <div className="h-8 flex-1 rounded-md" style={{ background: settings.themeColor }} />
                    <div className="h-8 flex-1 rounded-md" style={{ background: settings.themeColor + "20" }} />
                    <span className="text-[14px] font-bold" style={{ color: settings.themeColor }}>₹1,25,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DATA MANAGEMENT ─── */}
        {tab === "data" && (
          <div className="card p-6 space-y-5">
            <h2 className="sec-title">Data Management</h2>
            <p className="text-[12px] text-slate-400 mb-4">Export a full backup of your data or restore from a previous backup file.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Export */}
              <div className="p-5 rounded-lg text-center" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#EEF2FF" }}>
                  <Download size={22} className="text-indigo-500" />
                </div>
                <h3 className="text-[14px] font-bold text-slate-800">Export Backup</h3>
                <p className="text-[12px] text-slate-400 mt-1 mb-4">Download all your data as a JSON file.</p>
                <button
                  type="button"
                  onClick={async () => {
                    setBackupStatus("Exporting...");
                    try {
                      const data = await apiGet<Record<string, unknown>>("/api/backup");
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `quotegen-backup-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setBackupStatus("Backup exported successfully!");
                    } catch (err) {
                      setBackupStatus(`Export failed: ${err}`);
                    }
                    setTimeout(() => setBackupStatus(""), 4000);
                  }}
                  className="btn btn-primary"
                >
                  <Download size={14} /> Export Backup
                </button>
              </div>

              {/* Import */}
              <div className="p-5 rounded-lg text-center" style={{ background: "#FAFBFD", border: "1px solid #EEF0F6" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#FFF7ED" }}>
                  <UploadCloud size={22} className="text-orange-500" />
                </div>
                <h3 className="text-[14px] font-bold text-slate-800">Import Backup</h3>
                <p className="text-[12px] text-slate-400 mt-1 mb-4">Restore data from a previously exported JSON file.</p>
                <label className={`btn btn-outline inline-flex cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
                  <UploadCloud size={14} /> {importing ? "Importing..." : "Import Backup"}
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImporting(true);
                      setBackupStatus("Reading file...");
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        setBackupStatus("Importing data...");
                        await apiPost("/api/backup", data);
                        setBackupStatus("Backup imported successfully! Reloading settings...");
                        const updated = await apiGet<CompanySettings>("/api/settings");
                        if (updated) setSettings((prev) => ({ ...prev, ...updated }));
                      } catch (err) {
                        setBackupStatus(`Import failed: ${err}`);
                      }
                      setImporting(false);
                      e.target.value = "";
                      setTimeout(() => setBackupStatus(""), 5000);
                    }}
                  />
                </label>
              </div>
            </div>

            {backupStatus && (
              <div
                className="p-3 rounded-lg text-[12.5px] font-medium"
                style={{
                  background: backupStatus.includes("failed") ? "#FEF2F2" : "#ECFDF5",
                  color: backupStatus.includes("failed") ? "#DC2626" : "#059669",
                  border: `1px solid ${backupStatus.includes("failed") ? "#FECACA" : "#A7F3D0"}`,
                }}
              >
                {backupStatus}
              </div>
            )}

            <div className="p-3 rounded-lg" style={{ background: "#FEF9C3", border: "1px solid #FDE68A" }}>
              <p className="text-[11.5px] text-amber-700">
                <strong>Note:</strong> Importing a backup will upsert (merge) data. Existing records with the same ID will be updated. New records will be created. No existing data will be deleted.
              </p>
            </div>
          </div>
        )}

        {/* Save button — always visible except on Data tab */}
        {tab !== "data" && (
          <div className="flex items-center gap-4 pb-4">
            <button type="submit" disabled={saving} className={`btn btn-primary btn-lg${saving ? " btn-loading" : ""}`}>
              {saving ? <><div className="spinner spinner-sm" /> Saving…</> : <><Save size={16} /> Save Settings</>}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
