"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Download, Trash2, ShieldAlert } from "lucide-react";

export default function PrivacyDataPage() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

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
