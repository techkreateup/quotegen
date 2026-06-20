"use client";

import { useEffect, useState } from "react";
import { Info, AlertTriangle, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
}

const STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof Info }> = {
  INFO: { bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3", icon: Info },
  WARNING: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: AlertTriangle },
  CRITICAL: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: AlertTriangle },
};

const DISMISS_KEY = "qg_dismissed_announcements";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

// Platform announcement banners shown across tenant pages. Dismissals persist
// per-announcement in localStorage so they don't nag on every navigation.
export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissed());
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((d) => setItems(d.announcements ?? []))
      .catch(() => {});
  }, []);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  }

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ padding: "10px 20px 0" }}>
      {visible.map((a) => {
        const s = STYLES[a.severity] ?? STYLES.INFO;
        const Icon = s.icon;
        return (
          <div
            key={a.id}
            role="status"
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10,
              padding: "10px 12px", marginBottom: 8,
            }}
          >
            <Icon size={16} style={{ color: s.text, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: s.text }}>{a.title}</p>
              {a.body && <p style={{ fontSize: 12.5, color: s.text, opacity: 0.85, marginTop: 1 }}>{a.body}</p>}
            </div>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss announcement"
              style={{ border: "none", background: "transparent", color: s.text, cursor: "pointer", flexShrink: 0, opacity: 0.7 }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
