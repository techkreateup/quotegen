"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, CheckCircle2 } from "lucide-react";

export default function NewSupportTicketPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", description: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Submission failed.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900">Request submitted</h1>
        <p className="text-sm text-slate-500 mt-2">
          Thanks! We&apos;ve emailed you a confirmation and will reply soon.
        </p>
        <Link href="/login" className="inline-block mt-6 text-indigo-600 font-semibold text-sm">← Back to login</Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <div className="flex items-center gap-2 mb-1">
        <LifeBuoy size={20} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-slate-900">Contact Support</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">Tell us what&apos;s going on and we&apos;ll help.</p>

      <form onSubmit={submit} className="space-y-4">
        <input className="inp w-full" placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <input className="inp w-full" type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        <input className="inp w-full" placeholder="Subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} required />
        <textarea className="inp w-full" rows={5} placeholder="Describe your issue" value={form.description} onChange={(e) => set("description", e.target.value)} required />
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={status === "sending"} className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">
          {status === "sending" ? "Sending…" : "Submit request"}
        </button>
      </form>
    </main>
  );
}
