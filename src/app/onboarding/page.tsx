"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Circle,
  ListChecks,
  PartyPopper,
  Rocket,
  UserPlus,
} from "lucide-react";

const STEPS = ["Welcome", "Company Profile", "Invite Team", "Get Started"] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState({ hasClient: false, hasQuotation: false, hasTeamMember: false });

  // Company profile form
  const [profile, setProfile] = useState({ businessName: "", address: "", city: "", state: "", pincode: "", gstin: "", pan: "", email: "", website: "" });

  // Invite form
  const [invite, setInvite] = useState({ name: "", email: "", password: "" });
  const [invited, setInvited] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [inviteRoleId, setInviteRoleId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [ob, settings, rolesRes] = await Promise.all([
          fetch("/api/onboarding").then((r) => r.json()),
          fetch("/api/settings").then((r) => r.json()),
          fetch("/api/settings/roles").then((r) => r.json()),
        ]);
        if (ob?.progress?.completedAt) {
          window.location.href = "/";
          return;
        }
        setStep(ob?.progress?.currentStep ?? 0);
        setChecklist(ob?.checklist ?? checklist);
        setProfile((p) => ({
          ...p,
          businessName: settings?.businessName || "",
          address: settings?.address || "",
          city: settings?.city || "",
          state: settings?.state || "",
          pincode: settings?.pincode || "",
          gstin: settings?.gstin || "",
          pan: settings?.pan || "",
          email: settings?.email || "",
          website: settings?.website || "",
        }));
        const roleList = rolesRes?.roles || [];
        setRoles(roleList);
        const employeeRole = roleList.find((r: { name: string }) => r.name === "Employee");
        if (employeeRole) setInviteRoleId(employeeRole.id);
      } catch {
        setError("Failed to load onboarding state");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProgress(nextStep: number, extra?: Record<string, unknown>) {
    await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: nextStep, ...extra }),
    });
  }

  async function goTo(next: number) {
    setStep(next);
    saveProgress(next);
  }

  async function skip() {
    await saveProgress(step, { skipped: true });
    window.location.href = "/";
  }

  async function finish() {
    setSaving(true);
    await saveProgress(step, { completed: true });
    window.location.href = "/";
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      goTo(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    }
    setSaving(false);
  }

  async function sendInvite() {
    if (!invite.name || !invite.email || !invite.password) {
      setError("Name, email, and temporary password are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...invite, roleId: inviteRoleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvited((arr) => [...arr, invite.email]);
      setInvite({ name: "", email: "", password: "" });
      setChecklist((c) => ({ ...c, hasTeamMember: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite user");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading onboarding…
      </div>
    );
  }

  const inputCls =
    "w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500";

  return (
    <div className="min-h-screen bg-[#F0F2F8] relative overflow-hidden">
      {/* background décor */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[760px] h-[420px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.12), transparent)" }} />
        <div className="absolute top-40 -right-24 w-[320px] h-[320px] rounded-full mk-float-slow" style={{ background: "radial-gradient(closest-side, rgba(168,85,247,0.08), transparent)" }} />
      </div>

      {/* top bar */}
      <header className="relative flex items-center justify-between px-6 sm:px-10 h-[68px]">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}>
            <Rocket size={16} color="white" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-slate-900 leading-none">QuoteGen</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-none">Workspace setup</p>
          </div>
        </div>
        {step !== 3 && (
          <button onClick={skip} className="text-[12.5px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            Skip for now →
          </button>
        )}
      </header>

      <div className="relative max-w-2xl mx-auto px-4 pb-12 pt-2">
        {/* Stepper with progress line */}
        <div className="relative mb-8 mk-fade-up" role="list" aria-label="Onboarding steps">
          <div className="absolute top-4 left-[12%] right-[12%] h-[3px] rounded-full bg-slate-200" aria-hidden />
          <div
            className="absolute top-4 left-[12%] h-[3px] rounded-full transition-all duration-500"
            style={{ width: `${(step / (STEPS.length - 1)) * 76}%`, background: "linear-gradient(90deg,#10B981,#6366F1)" }}
            aria-hidden
          />
          <div className="relative flex items-start justify-between">
            {STEPS.map((label, i) => (
              <div key={label} role="listitem" className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold ring-4 ring-[#F0F2F8] transition-all ${
                    i < step ? "bg-emerald-500 text-white" : i === step ? "text-white shadow-[0_4px_12px_rgba(99,102,241,0.45)]" : "bg-white border-[1.5px] border-slate-200 text-slate-400"
                  }`}
                  style={i === step ? { background: "linear-gradient(135deg,#6366F1,#4F46E5)" } : {}}
                >
                  {i < step ? <CheckCircle2 size={17} /> : i + 1}
                </div>
                <span className={`text-[11px] sm:text-[12px] text-center font-semibold ${i === step ? "text-indigo-600" : i < step ? "text-slate-500" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mk-fade-up-1 bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6 sm:p-9">
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Rocket size={26} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome to QuoteGen 🎉</h1>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                Your company workspace is ready. In the next few steps we&apos;ll set up your business
                profile, invite your team, and show you the key features — quotations, invoices,
                payments, GST reports, and more.
              </p>
              <button
                onClick={() => goTo(1)}
                className="h-11 px-6 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                Let&apos;s set up →
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Company profile</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                This appears on your quotations, invoices, and receipts. You can change it anytime in Settings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="ob-name" className="block text-xs font-semibold text-gray-600 mb-1">Business name *</label>
                  <input id="ob-name" className={inputCls} value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ob-address" className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                  <input id="ob-address" className={inputCls} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="ob-city" className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                  <input id="ob-city" className={inputCls} value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="ob-state" className="block text-xs font-semibold text-gray-600 mb-1">State</label>
                  <input id="ob-state" className={inputCls} value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="ob-gstin" className="block text-xs font-semibold text-gray-600 mb-1">GSTIN (optional)</label>
                  <input id="ob-gstin" className={inputCls} value={profile.gstin} onChange={(e) => setProfile({ ...profile, gstin: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="ob-pan" className="block text-xs font-semibold text-gray-600 mb-1">PAN (optional)</label>
                  <input id="ob-pan" className={inputCls} value={profile.pan} onChange={(e) => setProfile({ ...profile, pan: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => goTo(0)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                <button
                  onClick={saveProfile}
                  disabled={saving || !profile.businessName}
                  className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save & continue →"}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <UserPlus size={18} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Invite your team</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Teammates get a temporary password and set their own on first login. You can also do this later under Settings → Users.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inv-name" className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                  <input id="inv-name" className={inputCls} value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="inv-email" className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input id="inv-email" type="email" className={inputCls} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="inv-pass" className="block text-xs font-semibold text-gray-600 mb-1">Temporary password</label>
                  <input id="inv-pass" className={inputCls} value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} placeholder="Min 8 chars, 1 upper, 1 number" />
                </div>
                <div>
                  <label htmlFor="inv-role" className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                  <select id="inv-role" className={inputCls} value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={sendInvite}
                disabled={saving}
                className="mt-4 h-10 px-5 rounded-lg border border-indigo-600 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
              >
                {saving ? "Adding…" : "+ Add team member"}
              </button>
              {invited.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {invited.map((e) => (
                    <li key={e} className="text-sm text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> {e} added
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-between mt-6">
                <button onClick={() => goTo(1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                <button onClick={() => goTo(3)} className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                  {invited.length > 0 ? "Continue →" : "Skip for now →"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ListChecks size={18} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">You&apos;re almost there</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Here&apos;s how QuoteGen works, start to finish:
              </p>
              <ol className="space-y-3 mb-6">
                {[
                  ["Add your clients", "Clients page — store GSTIN, contacts, and addresses", checklist.hasClient],
                  ["Create quotations", "Build quotes with line items, GST, and discounts, then send as PDF", checklist.hasQuotation],
                  ["Convert to invoices", "One click turns a won quotation into a GST invoice", false],
                  ["Record payments", "Payment receipts are generated automatically when invoices are paid", false],
                  ["Invite your team", "Control access per module with roles", checklist.hasTeamMember],
                ].map(([title, desc, done], i) => (
                  <li key={i} className="flex gap-3">
                    {done ? (
                      <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <Circle size={18} className="text-gray-300 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{title as string}</p>
                      <p className="text-xs text-gray-500">{desc as string}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex justify-between items-center">
                <button onClick={() => goTo(2)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                <button
                  onClick={finish}
                  disabled={saving}
                  className="h-11 px-6 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <PartyPopper size={16} /> {saving ? "Finishing…" : "Finish & go to dashboard"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center mt-5 text-[12px] text-slate-400">
          Your workspace is ready — this setup just helps you get the most out of it. You can revisit
          anything later from Settings.
        </p>
      </div>
    </div>
  );
}
