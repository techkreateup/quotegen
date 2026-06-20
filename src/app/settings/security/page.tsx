"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Shield, Lock, Clock, AlertTriangle } from "lucide-react";
import TwoFactorSettings from "@/components/TwoFactorSettings";

export default function SecurityPage() {
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: false,
  });
  const [sessionExpiry, setSessionExpiry] = useState(7);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [lockoutDuration, setLockoutDuration] = useState(15);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Security Settings"
        subtitle="Configure password policies, session settings, and login protection"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Security" }]}
      />

      <TwoFactorSettings />

      {/* Password Policy */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}><Lock size={13} color="#fff" /></div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Password Policy</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Set minimum requirements for user passwords</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-0 sm:pl-10">
          <div>
            <label className="lbl">Minimum Length</label>
            <input type="number" min={6} max={32} value={passwordPolicy.minLength}
              onChange={e => setPasswordPolicy(p => ({ ...p, minLength: parseInt(e.target.value) || 8 }))}
              className="inp" />
          </div>
          <div className="space-y-2.5">
            {([
              ["requireUppercase", "Require uppercase letter (A-Z)"],
              ["requireLowercase", "Require lowercase letter (a-z)"],
              ["requireNumber", "Require number (0-9)"],
              ["requireSpecial", "Require special character (!@#$...)"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={passwordPolicy[key]}
                  onChange={() => setPasswordPolicy(p => ({ ...p, [key]: !p[key] }))}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Session Settings */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="av av-sm" style={{ background: "#EFF6FF" }}><Clock size={13} color="#2563EB" /></div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Session Settings</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Control how long user sessions remain active</p>
          </div>
        </div>

        <div className="pl-0 sm:pl-10" style={{ maxWidth: 280 }}>
          <label className="lbl">Session Expiry (days)</label>
          <input type="number" min={1} max={90} value={sessionExpiry}
            onChange={e => setSessionExpiry(parseInt(e.target.value) || 7)}
            className="inp" />
          <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>Users will need to re-login after this period</p>
        </div>
      </div>

      {/* Login Protection */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="av av-sm" style={{ background: "#FFFBEB" }}><Shield size={13} color="#D97706" /></div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Login Protection</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Brute force protection settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-0 sm:pl-10">
          <div>
            <label className="lbl">Max Failed Attempts</label>
            <input type="number" min={3} max={20} value={maxAttempts}
              onChange={e => setMaxAttempts(parseInt(e.target.value) || 5)}
              className="inp" />
            <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>Account locked after this many failures</p>
          </div>
          <div>
            <label className="lbl">Lockout Duration (minutes)</label>
            <input type="number" min={5} max={120} value={lockoutDuration}
              onChange={e => setLockoutDuration(parseInt(e.target.value) || 15)}
              className="inp" />
            <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>How long the account stays locked</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="info-banner info-amber flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Security settings are currently read-only</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>These settings will be editable and persisted to the database in a future update. Current values reflect the system defaults.</div>
        </div>
      </div>
    </div>
  );
}
