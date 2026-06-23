"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Download, Trash2, ShieldAlert, Sparkles } from "lucide-react";

export default function PrivacyDataPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [contributes, setContributes] = useState(true);
  const [savingConsent, setSavingConsent] = useState(false);

  useEffect(() => {
    fetch("/api/advisor/consent")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setContributes(d.advisorContributes !== false))
      .catch(() => {});
  }, []);

  async function toggleConsent(next: boolean) {
    setSavingConsent(true);
    setContributes(next); // optimistic
    try {
      const res = await fetch("/api/advisor/consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorContributes: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "Contributing anonymized insights." : "Stopped contributing data.");
    } catch {
      setContributes(!next); // revert
      toast.error("Couldn't update your preference.");
    } finally {
      setSavingConsent(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/export-data");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotegen-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Deletion failed.");
        return;
      }
      toast.success("Account scheduled for deletion. Logging out…");
      setTimeout(() => (window.location.href = "/api/auth/logout"), 1500);
    } catch {
      toast.error("Deletion failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Privacy & Data"
        subtitle="Export your data or permanently delete your account"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Privacy & Data" }]}
      />

      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)" }}>
            <Download size={13} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Export my data</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Download all your workspace data as a JSON file.</p>
          </div>
        </div>
        <button onClick={exportData} disabled={exporting} className="btn btn-secondary mt-2">
          {exporting ? "Preparing…" : "Download export"}
        </button>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg,#7C3AED,#A78BFA)" }}>
            <Sparkles size={13} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
              Decision Advisor insights{" "}
              <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#F3E8FF", padding: "1px 6px", borderRadius: 6 }}>BETA</span>
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>
              Contribute your won/lost quote outcomes — fully anonymized and aggregated across companies —
              so the Advisor can show you peer win-rate and pricing benchmarks. We never share your client
              names, amounts, or any identifying detail; only pooled statistics. You can opt out anytime.
            </p>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", cursor: savingConsent ? "wait" : "pointer" }}>
            <input
              type="checkbox"
              checked={contributes}
              disabled={savingConsent}
              onChange={(e) => toggleConsent(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#7C3AED" }}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 20, borderColor: "#FECACA" }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="av av-sm" style={{ background: "#FEE2E2" }}>
            <ShieldAlert size={13} color="#DC2626" />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Delete my account</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>
              Permanently deletes your workspace and all data after a 30-day grace period. This cannot be undone.
            </p>
          </div>
        </div>
        <label className="lbl mt-2">Type your company name to confirm</label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Company name"
          className="inp"
          style={{ maxWidth: 320 }}
        />
        <div className="mt-3">
          <button
            onClick={deleteAccount}
            disabled={deleting || !confirm.trim()}
            className="btn"
            style={{ background: "#DC2626", color: "#fff", opacity: deleting || !confirm.trim() ? 0.6 : 1 }}
          >
            <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
