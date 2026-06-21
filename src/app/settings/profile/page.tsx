"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ImageUploader from "@/components/ImageUploader";
import { useAuth } from "@/components/AuthProvider";
import { UserCircle } from "lucide-react";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setAvatarUrl(d.user?.avatarUrl ?? ""))
      .catch(() => {});
  }, []);

  // Persist removals (uploads are saved server-side by UploadThing's callback).
  async function handleChange(url: string) {
    setAvatarUrl(url);
    if (url === "") {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: "" }),
      }).catch(() => {});
    }
    refresh(); // update the TopBar avatar immediately
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal profile photo and account details"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Profile" }]}
      />

      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}>
            <UserCircle size={13} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Profile Photo</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>A clear photo helps your team recognize you</p>
          </div>
        </div>

        <div className="pl-0 sm:pl-10">
          <ImageUploader
            endpoint="avatar"
            value={avatarUrl}
            onChange={handleChange}
            shape="circle"
            hint="JPG, PNG, WebP or SVG · up to 4MB"
          />
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>Account</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="lbl">Name</label>
            <div style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 600 }}>{user?.name ?? "—"}</div>
          </div>
          <div>
            <label className="lbl">Email</label>
            <div style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 600 }}>{user?.email ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
