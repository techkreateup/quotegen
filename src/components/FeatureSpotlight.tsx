"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, X, Sparkles, CalendarClock, ShieldCheck, FileText } from "lucide-react";

// One-time "what's new" promo for tenants. Each spotlight has a versioned key so
// we can run a new one later without re-showing old ones. Dismissal persists in
// localStorage (client-only, no extra DB write).
const KEY = "qg_spotlight_documents_v1";

export default function FeatureSpotlight() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Delay slightly so it doesn't fight the initial page paint.
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(KEY)) setOpen(true);
      } catch { /* ignore */ }
    }, 900);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  function explore() {
    dismiss();
    router.push("/documents");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={dismiss}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ animation: "qg-pop 220ms cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ background: "linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)", padding: "22px 22px 18px", position: "relative" }}>
          <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:bg-white/15"><X size={16} /></button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.18)" }}>
            <Sparkles size={12} color="#fff" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>NEW FEATURE</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <BookMarked size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Document Vault</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>Every company document, in one secure place</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 22px 22px" }}>
          <div className="space-y-2.5 mb-5">
            {[
              { icon: FileText, text: "Store HR, legal, payroll & compliance documents" },
              { icon: CalendarClock, text: "Expiry reminders so licenses never lapse" },
              { icon: ShieldCheck, text: "Compliance score + ready-made document templates" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#eef2ff" }}>
                  <f.icon size={14} className="text-indigo-600" />
                </div>
                <span style={{ fontSize: 13, color: "#334155" }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={explore} className="flex-1 h-11 rounded-lg bg-indigo-600 text-white text-[13.5px] font-semibold hover:bg-indigo-700">Explore the Vault</button>
            <button onClick={dismiss} className="px-4 h-11 rounded-lg border border-slate-200 text-slate-500 text-[13.5px] font-medium hover:bg-slate-50">Later</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes qg-pop{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
