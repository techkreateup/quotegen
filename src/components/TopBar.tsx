"use client";

import { useAuth } from "@/components/AuthProvider";
import { LogOut, Menu, Shield, User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";

interface TopBarProps {
  onMenuOpen: () => void;
}

export default function TopBar({ onMenuOpen }: TopBarProps) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header style={{
      height: 58,
      flexShrink: 0,
      background: "rgba(255,255,255,0.98)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid #E2E5EF",
      boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 10,
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>

      {/* Mobile: hamburger + brand — hidden on lg+ via Tailwind (using Tailwind display, not inline) */}
      <div className="flex lg:hidden items-center gap-2.5">
        <button
          onClick={onMenuOpen}
          aria-label="Open navigation"
          style={{
            width: 36, height: 36, borderRadius: 9,
            border: "1.5px solid #E2E5EF",
            background: "#FFFFFF",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            flexShrink: 0,
            color: "#374151",
          }}
          className="flex items-center justify-center transition-all hover:border-slate-400"
        >
          <Menu size={17} />
        </button>

        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/quotegen/QGF_wordmark_SVG.svg" alt="QuoteGen"
               style={{ height: 24, width: "auto", display: "block", flexShrink: 0 }} />
        </div>
      </div>

      {/* Global Search */}
      <GlobalSearch />

      {/* Flex spacer */}
      <div style={{ flex: 1 }} />

      {/* Right side controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Notifications */}
        <NotificationBell />

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "#E2E5EF", flexShrink: 0 }} />

        {/* Role badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 999,
          fontSize: 11.5, fontWeight: 700,
          background: user.isSystemAdmin ? "#EEF2FF" : "#F8F9FA",
          color:      user.isSystemAdmin ? "#4F46E5"  : "#6B7280",
          border:     user.isSystemAdmin ? "1.5px solid #C7D2FE" : "1.5px solid #D9DCE5",
          whiteSpace: "nowrap",
        }}>
          {user.isSystemAdmin ? <Shield size={11} /> : <User size={11} />}
          <span className="hidden xs:inline">{user.roleName || "User"}</span>
        </span>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "#E2E5EF", flexShrink: 0 }} />

        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0, overflow: "hidden",
            background: user.avatarUrl ? "#fff" : "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 800,
            boxShadow: "0 2px 6px rgba(99,102,241,0.35)",
          }}>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <span
            style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            className="hidden sm:block"
          >
            {user.name}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "#E2E5EF", flexShrink: 0 }} />

        {/* Sign out */}
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8, border: "1.5px solid transparent",
            background: "transparent", cursor: "pointer",
            fontSize: 13, fontWeight: 500, color: "#6B7280",
            transition: "all 150ms",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "#FEF2F2";
            el.style.color = "#DC2626";
            el.style.borderColor = "#FECACA";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "transparent";
            el.style.color = "#6B7280";
            el.style.borderColor = "transparent";
          }}
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
