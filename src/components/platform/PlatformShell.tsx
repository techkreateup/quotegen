"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  Users,
  X,
  Zap,
} from "lucide-react";

interface Me {
  name: string;
  platformRole: "SUPER_ADMIN" | "SUPPORT" | string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof BarChart3;
}
interface NavSection {
  title: string | null;
  items: NavItem[];
}

// Shared chrome for the /admin and /support areas.
// Deliberately mirrors the tenant AppShell (Sidebar + TopBar) so the platform
// console feels like the same product, not separate software.
export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [mobOpen, setMobOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? d))
      .catch(() => {});
  }, []);

  const isSuperAdmin = me?.platformRole === "SUPER_ADMIN";

  const nav: NavSection[] = isSuperAdmin
    ? [
        {
          title: null,
          items: [{ href: "/admin", label: "Dashboard", icon: BarChart3 }],
        },
        {
          title: "Manage",
          items: [
            { href: "/admin/companies", label: "Companies", icon: Building2 },
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/features", label: "Feature Flags", icon: SlidersHorizontal },
            { href: "/admin/plans", label: "Plans", icon: LayoutGrid },
          ],
        },
        {
          title: "Insight",
          items: [
            { href: "/admin/reports", label: "Reports", icon: BarChart3 },
            { href: "/admin/revenue", label: "Revenue", icon: BarChart3 },
            { href: "/admin/inactive", label: "Re-engagement", icon: UserMinus },
            { href: "/admin/audit", label: "Audit & Security", icon: ShieldCheck },
          ],
        },
        {
          title: "Operate",
          items: [
            { href: "/admin/announcements", label: "Announcements", icon: Bell },
            { href: "/support/issues", label: "Support Issues", icon: LifeBuoy },
            { href: "/admin/support-users", label: "Support Team", icon: Shield },
          ],
        },
        {
          title: "Platform",
          items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
        },
      ]
    : [
        {
          title: null,
          items: [
            { href: "/support", label: "Companies", icon: Building2 },
            { href: "/support/issues", label: "Issues", icon: LifeBuoy },
          ],
        },
      ];

  const active = (href: string) => {
    if (href === "/admin" || href === "/support") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "clip", background: "var(--bg)" }}>
      {/* Mobile overlay */}
      {mobOpen && (
        <div
          onClick={() => setMobOpen(false)}
          className="fixed inset-0 lg:hidden"
          style={{ zIndex: 40, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
        />
      )}

      {/* Sidebar — same look as the tenant Sidebar */}
      <aside
        style={{
          width: 248,
          minWidth: 248,
          height: "100%",
          background: "#FFFFFF",
          borderRight: "1px solid #D1D5E0",
          boxShadow: mobOpen ? "4px 0 24px rgba(15,23,42,0.12)" : "2px 0 12px rgba(15,23,42,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 50,
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1), box-shadow 280ms",
        }}
        className={`fixed lg:static top-0 left-0 ${mobOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
            }}
          >
            <Zap size={17} color="white" strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", lineHeight: 1 }}>QuoteGen</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginTop: 2 }}>
              {isSuperAdmin ? "Super Admin" : "Support Console"}
            </div>
          </div>

          <button
            onClick={() => setMobOpen(false)}
            aria-label="Close menu"
            className="flex lg:hidden items-center justify-center transition-colors"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
              color: "#9CA3AF", cursor: "pointer", flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ height: 1, background: "#E8EAEF", margin: "0 14px 6px" }} />

        {/* Nav — same link styling as the tenant sidebar */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "4px 10px 12px" }} aria-label="Platform navigation">
          {nav.map((section, si) => (
            <div key={section.title ?? `s${si}`} style={{ marginBottom: 6 }}>
              {section.title && (
                <div
                  style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    textTransform: "uppercase", color: "#9CA3AF",
                    padding: "10px 10px 4px",
                  }}
                >
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = active(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8, marginBottom: 1,
                      fontSize: 13, fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#4F46E5" : "#6B7280",
                      background: isActive ? "#EEF2FF" : "transparent",
                      textDecoration: "none", transition: "all 140ms",
                    }}
                    onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "#F5F6FA"; (e.currentTarget as HTMLElement).style.color = "#374151"; } }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; } }}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.2 : 1.7} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366F1", flexShrink: 0 }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "8px 10px 14px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #EEF2FF 0%, #F0F4FF 100%)",
              border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 13px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4F46E5", lineHeight: 1 }}>Platform Console</div>
            <div style={{ fontSize: 11, color: "#818CF8", marginTop: 3 }}>Manage companies & support</div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "clip" }}>
        {/* TopBar — same look as the tenant TopBar */}
        <header
          style={{
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
          }}
        >
          {/* Mobile: hamburger + brand */}
          <div className="flex lg:hidden items-center gap-2.5">
            <button
              onClick={() => setMobOpen(true)}
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
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                  boxShadow: "0 1px 4px rgba(99,102,241,0.35)",
                }}
                className="flex items-center justify-center"
              >
                <Zap size={13} color="white" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>QuoteGen</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Role badge */}
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 999,
                fontSize: 11.5, fontWeight: 700,
                background: "#EEF2FF", color: "#4F46E5",
                border: "1.5px solid #C7D2FE",
                whiteSpace: "nowrap",
              }}
            >
              <Shield size={11} />
              <span className="hidden xs:inline">{isSuperAdmin ? "Super Admin" : "Support"}</span>
            </span>

            <div style={{ width: 1, height: 22, background: "#E2E5EF", flexShrink: 0 }} />

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 800,
                  boxShadow: "0 2px 6px rgba(99,102,241,0.35)",
                }}
              >
                {(me?.name ?? "?").charAt(0).toUpperCase()}
              </div>
              <span
                style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                className="hidden sm:block"
              >
                {me?.name}
              </span>
            </div>

            <div style={{ width: 1, height: 22, background: "#E2E5EF", flexShrink: 0 }} />

            <button
              onClick={signOut}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8, border: "1.5px solid transparent",
                background: "transparent", cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: "#6B7280",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "#FEF2F2";
                el.style.color = "#DC2626";
                el.style.borderColor = "#FECACA";
              }}
              onMouseLeave={(e) => {
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

        <main style={{ flex: 1, overflowY: "auto" }}>
          <div className="page-wrapper page-enter" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
