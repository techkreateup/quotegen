"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Employee } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import SignaturePad from "@/components/SignaturePad";
import {
  User, Building2, CreditCard, FileText, PenTool,
  Upload, X, Camera, ChevronRight, Save, ArrowLeft,
} from "lucide-react";
import { validateEmail, validatePhone, validatePAN, validateAadhar } from "@/lib/validation";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const DEPARTMENTS = [
  "Engineering", "Design", "Marketing", "Sales", "Finance",
  "HR", "Operations", "Management", "Support", "Other",
];

type EmployeeForm = Omit<Employee, "id" | "employeeCode" | "createdAt" | "updatedAt">;

const emptyForm: EmployeeForm = {
  name: "", email: "", phone: "", designation: "", department: "",
  dateOfJoining: null, salary: 0, bankName: "", accountNumber: "",
  ifsc: "", accountName: "", signatureUrl: "", photoUrl: "",
  status: "Active", emergencyContact: "", address: "", pan: "",
  aadhar: "", notes: "",
};

type Tab = "personal" | "employment" | "bank" | "documents" | "signature";

const tabs: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "personal", label: "Personal Info", icon: User },
  { key: "employment", label: "Employment", icon: Building2 },
  { key: "bank", label: "Bank Details", icon: CreditCard },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "signature", label: "Digital Signature", icon: PenTool },
];

function EmployeeFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [tab, setTab] = useState<Tab>("personal");
  const [saving, setSaving] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleBlurValidate(field: string, value: string) {
    let result = { valid: true, message: "" };
    if (field === "email") result = validateEmail(value);
    else if (field === "phone") result = validatePhone(value);
    else if (field === "pan") result = validatePAN(value);
    else if (field === "aadhar") result = validateAadhar(value);
    setErrors(prev => ({ ...prev, [field]: result.valid ? "" : result.message }));
  }

  useEffect(() => {
    if (editId) {
      apiGet<Employee>(`/api/employees/${editId}`).then((emp) => {
        if (!emp) return;
        setEmployeeCode(emp.employeeCode);
        setForm({
          name: emp.name, email: emp.email, phone: emp.phone,
          designation: emp.designation, department: emp.department,
          dateOfJoining: emp.dateOfJoining ? new Date(emp.dateOfJoining).toISOString().split("T")[0] : null,
          salary: emp.salary, bankName: emp.bankName, accountNumber: emp.accountNumber,
          ifsc: emp.ifsc, accountName: emp.accountName, signatureUrl: emp.signatureUrl || "",
          photoUrl: emp.photoUrl || "", status: emp.status, emergencyContact: emp.emergencyContact,
          address: emp.address, pan: emp.pan, aadhar: emp.aadhar, notes: emp.notes,
        });
      });
    }
  }, [editId]);

  function set<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set("photoUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    const newErrors: Record<string, string> = {};
    const e1 = validateEmail(form.email); if (!e1.valid) newErrors.email = e1.message;
    const e2 = validatePhone(form.phone); if (!e2.valid) newErrors.phone = e2.message;
    const e3 = validatePAN(form.pan); if (!e3.valid) newErrors.pan = e3.message;
    const e4 = validateAadhar(form.aadhar); if (!e4.valid) newErrors.aadhar = e4.message;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setSaving(true);
    try {
      if (editId) {
        await apiPut(`/api/employees/${editId}`, form);
      } else {
        await apiPost("/api/employees", form);
      }
      router.push("/employees");
    } catch (err) {
      (await alertDialog({ title: "Notice", message: err instanceof Error ? err.message : "Failed to save employee" }));
      setSaving(false);
    }
  }

  const tabIndex = tabs.findIndex((t) => t.key === tab);

  function nextTab() {
    if (tabIndex < tabs.length - 1) setTab(tabs[tabIndex + 1].key);
  }

  function prevTab() {
    if (tabIndex > 0) setTab(tabs[tabIndex - 1].key);
  }

  return (
    <div>
      <PageHeader
        title={editId ? "Edit Employee" : "Add New Employee"}
        breadcrumbs={[
          { label: "HR & Payroll" },
          { label: "Employees", href: "/employees" },
          { label: editId ? "Edit" : "New" },
        ]}
        action={
          <button onClick={() => router.push("/employees")} className="btn btn-outline btn-sm">
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: Tab Navigation */}
          <div className="w-full lg:w-60 lg:shrink-0">
            {/* Profile Card */}
            <div className="card p-6 mb-4" style={{borderRadius: 16}}>
              <div className="flex flex-col items-center">
                <div className="relative group mb-4">
                  {form.photoUrl ? (
                    <div className="relative">
                      <img src={form.photoUrl} alt="Photo" className="w-24 h-24 rounded-2xl object-cover shadow-sm" />
                      <button type="button" onClick={() => set("photoUrl", "")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm">
                      <Camera size={20} className="text-indigo-400 mb-1" />
                      <span className="text-[10px] text-indigo-500 font-medium">Add Photo</span>
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  )}
                </div>
                {form.name && <p className="font-semibold text-gray-900 text-center">{form.name}</p>}
                {form.designation && <p className="text-xs text-gray-500 mt-0.5">{form.designation}</p>}
                {employeeCode && (
                  <span className="mt-2 text-[11px] font-mono bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{employeeCode}</span>
                )}
              </div>
            </div>

            {/* Tab List */}
            <div className="card overflow-hidden" style={{borderRadius: 16}}>
              {tabs.map((t, i) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                const isCompleted = i < tabIndex;
                return (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-medium border-l-[3px] border-indigo-600"
                        : "text-gray-600 hover:bg-gray-50 border-l-[3px] border-transparent"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-indigo-100 text-indigo-600" : isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      <Icon size={15} />
                    </div>
                    <span className="flex-1">{t.label}</span>
                    <ChevronRight size={14} className={isActive ? "text-indigo-400" : "text-gray-300"} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Form Content */}
          <div className="flex-1 min-w-0">
            <div className="card">
              {/* Tab Header */}
              <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {(() => { const Icon = tabs[tabIndex].icon; return <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><Icon size={18} /></div>; })()}
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">{tabs[tabIndex].label}</h2>
                    <p className="text-[12.5px] text-slate-500">
                      {tab === "personal" && "Basic personal information and contact details"}
                      {tab === "employment" && "Job role, department, and salary information"}
                      {tab === "bank" && "Bank account details for salary disbursement"}
                      {tab === "documents" && "Identity documents and additional notes"}
                      {tab === "signature" && "Digital signature for official documents and vouchers"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              <div className="px-4 sm:px-8 py-5 sm:py-6">
                {tab === "personal" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="lbl">Full Name <span className="text-red-400">*</span></label>
                        <input type="text" required value={form.name} onChange={(e) => set("name", e.target.value)}
                          placeholder="Enter full name"
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Email <span className="text-red-400">*</span></label>
                        <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)}
                          onBlur={() => handleBlurValidate("email", form.email)}
                          placeholder="name@company.com"
                          className="inp" />
                        {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="lbl">Phone</label>
                        <input type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                          onBlur={() => handleBlurValidate("phone", form.phone)}
                          placeholder="+91 XXXXX XXXXX"
                          className="inp" />
                        {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
                      </div>
                      <div>
                        <label className="lbl">Emergency Contact</label>
                        <input type="text" value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)}
                          placeholder="Name — Phone"
                          className="inp" />
                      </div>
                    </div>
                    <div>
                      <label className="lbl">Address</label>
                      <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
                        placeholder="Full residential address"
                        rows={3}
                        className="inp" />
                    </div>
                  </div>
                )}

                {tab === "employment" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="lbl">Designation</label>
                        <input type="text" value={form.designation} onChange={(e) => set("designation", e.target.value)}
                          placeholder="e.g. Senior Designer"
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Department</label>
                        <select value={form.department} onChange={(e) => set("department", e.target.value)}
                          className="inp">
                          <option value="">Select Department</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="lbl">Date of Joining</label>
                        <input type="date" value={form.dateOfJoining || ""} onChange={(e) => set("dateOfJoining", e.target.value || null)}
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Status</label>
                        <select value={form.status} onChange={(e) => set("status", e.target.value as Employee["status"])}
                          className="inp">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="lbl">Monthly Salary (INR)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] z-10">₹</span>
                          <input type="number" value={form.salary || ""} onChange={(e) => set("salary", Number(e.target.value))}
                            placeholder="0" className="inp pl-7" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "bank" && (
                  <div className="space-y-5">
                    <div className="info-banner info-blue">
                      Bank details are used for salary disbursement and payment vouchers.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="lbl">Bank Name</label>
                        <input type="text" value={form.bankName} onChange={(e) => set("bankName", e.target.value)}
                          placeholder="e.g. State Bank of India"
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Account Holder Name</label>
                        <input type="text" value={form.accountName} onChange={(e) => set("accountName", e.target.value)}
                          placeholder="Name as on bank account"
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Account Number</label>
                        <input type="text" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)}
                          placeholder="Enter account number"
                          className="inp" />
                      </div>
                      <div>
                        <label className="lbl">IFSC Code</label>
                        <input type="text" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)}
                          placeholder="e.g. SBIN0001234"
                          className="inp" />
                      </div>
                    </div>
                  </div>
                )}

                {tab === "documents" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="lbl">PAN Number</label>
                        <input type="text" value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())}
                          onBlur={() => handleBlurValidate("pan", form.pan)}
                          placeholder="ABCDE1234F" maxLength={10}
                          className="inp font-mono tracking-wider" />
                        {errors.pan && <p className="text-[11px] text-red-500 mt-1">{errors.pan}</p>}
                      </div>
                      <div>
                        <label className="lbl">Aadhar Number</label>
                        <input type="text" value={form.aadhar} onChange={(e) => set("aadhar", e.target.value.replace(/\D/g, "").slice(0, 12))}
                          onBlur={() => handleBlurValidate("aadhar", form.aadhar)}
                          placeholder="XXXX XXXX XXXX" maxLength={12}
                          className="inp font-mono tracking-wider" />
                        {errors.aadhar && <p className="text-[11px] text-red-500 mt-1">{errors.aadhar}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="lbl">Notes</label>
                      <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                        placeholder="Any additional notes about this employee..."
                        rows={4}
                        className="inp" />
                    </div>
                  </div>
                )}

                {tab === "signature" && (
                  <div className="space-y-5">
                    <div className="info-banner info-amber">
                      This digital signature will be used on payment vouchers and official documents. Draw below or upload a signature image.
                    </div>
                    <div className="w-full max-w-[460px]">
                      <SignaturePad
                        value={form.signatureUrl}
                        onChange={(url) => set("signatureUrl", url)}
                        label="Employee Signature"
                        width={460}
                        height={180}
                      />
                    </div>
                    {form.signatureUrl && (
                      <div className="info-banner info-green flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <PenTool size={14} className="text-emerald-600" />
                        </div>
                        <p className="text-sm text-emerald-700">Signature captured successfully. This will appear on vouchers and documents.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tabIndex > 0 && (
                    <button type="button" onClick={prevTab} className="btn btn-outline">
                      Previous
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => router.push("/employees")} className="btn btn-outline">
                    Cancel
                  </button>
                  {tabIndex < tabs.length - 1 ? (
                    <button type="button" onClick={nextTab} className="btn btn-primary">
                      Next <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button type="submit" disabled={saving} className="btn btn-primary">
                      <Save size={14} /> {saving ? "Saving…" : editId ? "Update Employee" : "Save Employee"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <EmployeeFormPage />
    </Suspense>
  );
}
