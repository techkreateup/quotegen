"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ImageUploader from "@/components/ImageUploader";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { UserCircle, ShieldCheck, Accessibility, Lock, BookMarked, ChevronRight, BadgeCheck, Save } from "lucide-react";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d) => {
        const p = d.profile;
        if (!p) return;
        setAvatarUrl(p.avatarUrl ?? "");
        setName(p.name ?? "");
        setEmail(p.email ?? "");
        setPhone(p.phone ?? "");
        setBio(p.bio ?? "");
        setVerified(!!p.emailVerified);
      })
      .catch(() => {});
  }, []);

  async function handleAvatar(url: string) {
    setAvatarUrl(url);
    if (url === "") {
      await fetch("/api/settings/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: "" }),
      }).catch(() => {});
    }
    refresh();
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, bio }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Profile saved");
      refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Could not save");
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your photo, contact details and personal preferences"
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
          <ImageUploader endpoint="avatar" value={avatarUrl} onChange={handleAvatar} shape="circle" hint="Auto-compressed to WebP · up to 4MB" />
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>Account details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="lbl">Display name</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="lbl">Email</label>
            <div className="flex items-center gap-1.5 h-[42px]">
              <span style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 600 }}>{email || "—"}</span>
              {verified && <BadgeCheck size={15} className="text-emerald-500" />}
            </div>
          </div>
          <div>
            <label className="lbl">Phone</label>
            <input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="sm:col-span-2">
            <label className="lbl">Bio</label>
            <textarea className="inp" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} placeholder="A short line about your role…" />
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3, textAlign: "right" }}>{bio.length}/300</div>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
            <Save size={14} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Preferences hub */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", margin: "4px 2px 10px" }}>Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { href: "/settings/security", icon: ShieldCheck, title: "Security & 2FA", desc: "Password, two-factor authentication, sessions" },
            { href: "/settings/accessibility", icon: Accessibility, title: "Appearance & Accessibility", desc: "Theme, contrast, text size, motion" },
            { href: "/settings/privacy", icon: Lock, title: "Privacy & Data", desc: "Export your data, manage account" },
            { href: "/documents", icon: BookMarked, title: "Document Vault", desc: "Your company & personal documents" },
          ].map((it) => (
            <Link key={it.href} href={it.href} className="card flex items-center gap-3 hover:border-indigo-200 transition-colors" style={{ padding: 14, textDecoration: "none" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#eef2ff" }}>
                <it.icon size={16} className="text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }} className="truncate">{it.desc}</div>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
