"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { ShieldCheck, ShieldOff } from "lucide-react";
import Image from "next/image";

export default function TwoFactorSettings() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.user?.twoFactorEnabled))
      .catch(() => setEnabled(false));
  }, []);

  async function startSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setQr(d.qr);
      setSecret(d.secret);
    } catch {
      toast.error("Could not start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Two-factor authentication enabled.");
      setEnabled(true);
      setQr("");
      setSecret("");
      setToken("");
    } catch (e) {
      toast.error((e as Error).message || "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Two-factor authentication disabled.");
      setEnabled(false);
      setToken("");
    } catch (e) {
      toast.error((e as Error).message || "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg,#10B981,#34D399)" }}>
          <ShieldCheck size={13} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Two-Factor Authentication</h3>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            {enabled ? "2FA is active on your account." : "Add a TOTP code at login for extra security."}
          </p>
        </div>
      </div>

      {enabled === false && !qr && (
        <button onClick={startSetup} disabled={busy} className="btn btn-primary">
          {busy ? "Please wait…" : "Enable 2FA"}
        </button>
      )}

      {qr && (
        <div className="space-y-3 pl-0 sm:pl-10">
          <p className="text-sm text-slate-600">Scan with Google Authenticator / Authy, then enter the 6-digit code.</p>
          <Image src={qr} alt="2FA QR code" width={160} height={160} unoptimized />
          <p className="text-xs text-slate-400">Or enter this secret manually: <code>{secret}</code></p>
          <input className="inp" style={{ maxWidth: 220 }} value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" inputMode="numeric" />
          <div><button onClick={confirm} disabled={busy || !token} className="btn btn-primary">Verify & enable</button></div>
        </div>
      )}

      {enabled === true && (
        <div className="space-y-3 pl-0 sm:pl-10">
          <label className="lbl">Enter a current code to disable 2FA</label>
          <input className="inp" style={{ maxWidth: 220 }} value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" inputMode="numeric" />
          <div>
            <button onClick={disable} disabled={busy || !token} className="btn" style={{ background: "#DC2626", color: "#fff" }}>
              <ShieldOff size={14} /> Disable 2FA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
