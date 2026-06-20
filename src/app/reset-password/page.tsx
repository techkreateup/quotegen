"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { AuthShell, AuthField, AuthError, AuthButton, PasswordStrength } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  // Token flow = arrived via "forgot password" email link (not logged in)
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, newPassword } : { newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      window.location.href = token ? "/login" : "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={token ? "Choose a new password" : "Set your password"}
      subtitle={
        token
          ? "Pick a strong password for your account — you'll use it from now on."
          : "For your security, set a new password before continuing to your workspace."
      }
      badge="Encrypted at rest"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <AuthField
            label="New password"
            icon={Lock}
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 chars, upper & lowercase, number"
          />
          <PasswordStrength password={newPassword} />
        </div>
        <AuthField
          label="Confirm password"
          icon={Lock}
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat password"
        />
        <AuthError message={error} />
        <AuthButton loading={loading}>
          {loading ? "Saving…" : token ? "Set new password" : "Set password & continue"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
