"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, X, AlertCircle, Clock, RefreshCw, Briefcase, FileCheck, Info } from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Notification } from "@/lib/types";
import Link from "next/link";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  OverdueInvoice:   { icon: AlertCircle, color: "#DC2626", bg: "#FEF2F2" },
  DeadlineReminder: { icon: Clock,       color: "#D97706", bg: "#FFFBEB" },
  RenewalReminder:  { icon: RefreshCw,   color: "#7C3AED", bg: "#F5F3FF" },
  SalaryDue:        { icon: Briefcase,   color: "#2563EB", bg: "#EFF6FF" },
  VoucherPending:   { icon: FileCheck,   color: "#EA580C", bg: "#FFF7ED" },
  General:          { icon: Info,        color: "#6B7280", bg: "#F9FAFB" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const load = useCallback(async () => {
    try {
      const data = await apiGet<Notification[]>("/api/notifications");
      setNotifications(data);
    } catch {}
  }, []);

  // Generate + load on mount
  useEffect(() => {
    (async () => {
      try {
        await apiPost("/api/notifications/generate", {});
      } catch {}
      load();
    })();
    // Refresh every 5 minutes
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await apiPut("/api/notifications", { id });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiPut("/api/notifications", { markAllRead: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{
          width: 36, height: 36, borderRadius: 9,
          border: "1.5px solid #E2E5EF",
          background: open ? "#F1F5F9" : "#FFFFFF",
          cursor: "pointer",
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 150ms",
          color: "#374151",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#C7D2FE"; (e.currentTarget as HTMLElement).style.background = "#F8F9FC"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E2E5EF"; (e.currentTarget as HTMLElement).style.background = open ? "#F1F5F9" : "#FFFFFF"; }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: "#EF4444", color: "#fff",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px",
            border: "2px solid #fff",
            boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 44, right: 0,
          width: 380, maxHeight: 480,
          background: "#fff",
          border: "1.5px solid #D1D5E0",
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.08)",
          zIndex: 100,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #EAECF0",
            background: "#FAFBFD",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 8, padding: "2px 8px", borderRadius: 999,
                  fontSize: 11, fontWeight: 700,
                  background: "#EEF2FF", color: "#4F46E5",
                }}>
                  {unreadCount} new
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 7,
                    fontSize: 11.5, fontWeight: 600,
                    background: "#EEF2FF", color: "#4F46E5",
                    border: "none", cursor: "pointer",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#E0E7FF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#EEF2FF"; }}
                >
                  <CheckCheck size={12} /> Read all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: "none", background: "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#9CA3AF",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <Bell size={28} style={{ color: "#D1D5DB", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>No notifications yet</div>
                <div style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4 }}>We&apos;ll alert you about overdue invoices, renewals, and deadlines</div>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.General;
                const Icon = cfg.icon;
                const inner = (
                  <div
                    key={n.id}
                    style={{
                      display: "flex", gap: 12, padding: "12px 16px",
                      borderBottom: "1px solid #F5F6FA",
                      background: n.isRead ? "transparent" : "#FAFBFF",
                      cursor: "pointer",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F7FF"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.isRead ? "transparent" : "#FAFBFF"; }}
                    onClick={() => { if (!n.isRead) markRead(n.id); }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: cfg.bg, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={15} color={cfg.color} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: "#0F172A", lineHeight: 1.3 }}>
                          {n.title}
                        </span>
                        {!n.isRead && (
                          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#4F46E5", flexShrink: 0, marginTop: 5 }} />
                        )}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </div>
                );

                if (n.link) {
                  return (
                    <Link key={n.id} href={n.link} style={{ textDecoration: "none", display: "block" }} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  );
                }
                return inner;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
