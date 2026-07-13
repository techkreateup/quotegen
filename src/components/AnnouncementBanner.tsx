"use client";

import { useEffect, useState } from "react";
import { Info, AlertTriangle, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
}

const STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof Info; accent: string }> = {
  INFO:     { bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3", icon: Info,           accent: "#6366F1" },
  WARNING:  { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: AlertTriangle,  accent: "#F59E0B" },
  CRITICAL: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: AlertTriangle,  accent: "#EF4444" },
};

const DISMISS_KEY = "qg_dismissed_announcements";
const SEEN_KEY = "qg_announcement_seen_count";
const MAX_SHOWS = 5;

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
}
function getSeenCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}

// Single-card announcement carousel. Shows ONE banner at a time with prev/next
// controls and a per-card dismiss. Each card is auto-hidden after 5 views (bumped
// once per tab session). Replaces the older stacked list that overwhelmed the
// dashboard when several announcements were live at once.
export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setDismissed(getDismissed());
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((d) => {
        const rows: Announcement[] = d.announcements ?? [];
        const seen = getSeenCounts();
        const persistDismissed = getDismissed();
        const alreadyCounted = typeof sessionStorage !== "undefined"
          && sessionStorage.getItem("qg_announcement_counted") === "1";
        const survivors = rows.filter(a => !persistDismissed.includes(a.id));
        const autoDismiss: string[] = [];
        const nextSeen = { ...seen };
        if (!alreadyCounted) {
          for (const a of survivors) {
            nextSeen[a.id] = (nextSeen[a.id] || 0) + 1;
            if (nextSeen[a.id] > MAX_SHOWS) autoDismiss.push(a.id);
          }
          try { localStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen)); } catch {}
          try { sessionStorage.setItem("qg_announcement_counted", "1"); } catch {}
        } else {
          for (const a of survivors) if ((nextSeen[a.id] || 0) > MAX_SHOWS) autoDismiss.push(a.id);
        }
        if (autoDismiss.length) {
          const merged = [...persistDismissed, ...autoDismiss];
          setDismissed(merged);
          try { localStorage.setItem(DISMISS_KEY, JSON.stringify(merged)); } catch {}
        }
        setItems(rows);
      })
      .catch(() => {});
  }, []);

  const visible = items.filter((a) => !dismissed.includes(a.id));
  const total = visible.length;

  // Keep index in-bounds when the visible list shrinks (dismissal, etc.).
  useEffect(() => {
    if (idx >= total && total > 0) setIdx(total - 1);
    if (total === 0) setIdx(0);
  }, [total, idx]);

  if (total === 0) return null;
  const current = visible[Math.min(idx, total - 1)];
  const s = STYLES[current.severity] ?? STYLES.INFO;
  const Icon = s.icon;

  function dismissCurrent() {
    const next = [...dismissed, current.id];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
    // After dismissing, stay on the same index (which now points at the next
    // one) — the effect above handles the shrink-to-zero case.
  }
  function dismissAll() {
    const next = [...dismissed, ...visible.map((a) => a.id)];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
  }
  function prev() { setIdx((i) => (i - 1 + total) % total); }
  function next() { setIdx((i) => (i + 1) % total); }

  return (
    <div style={{ padding: "10px 20px 0" }}>
      <div
        role="status"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
          padding: "10px 12px",
          transition: "background 0.15s",
        }}
      >
        <Icon size={16} style={{ color: s.text, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: s.text, margin: 0, lineHeight: 1.35 }}>{current.title}</p>
          {current.body && (
            <p style={{
              fontSize: 12.5, color: s.text, opacity: 0.85, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {current.body}
            </p>
          )}
        </div>
        {total > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button
              onClick={prev}
              aria-label="Previous announcement"
              style={{ border: "none", background: "transparent", color: s.text, cursor: "pointer", opacity: 0.7, padding: 4, display: "flex" }}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: s.text, opacity: 0.7, minWidth: 32, textAlign: "center" }}>
              {idx + 1} / {total}
            </span>
            <button
              onClick={next}
              aria-label="Next announcement"
              style={{ border: "none", background: "transparent", color: s.text, cursor: "pointer", opacity: 0.7, padding: 4, display: "flex" }}
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={dismissAll}
              aria-label="Dismiss all announcements"
              style={{ border: "none", background: "transparent", color: s.text, cursor: "pointer", opacity: 0.7, padding: 4, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Clear all
            </button>
          </div>
        )}
        <button
          onClick={dismissCurrent}
          aria-label="Dismiss this announcement"
          style={{ border: "none", background: "transparent", color: s.text, cursor: "pointer", flexShrink: 0, opacity: 0.7, padding: 4, display: "flex" }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
