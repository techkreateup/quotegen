"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePermissions } from "@/components/AuthProvider";
import { hasPermission, type Module } from "@/lib/permissions";
import { isPremiumModule, MODULE_TO_FEATURE } from "@/lib/features";
import {
  LayoutDashboard, Users, FileText, Receipt, CreditCard,
  BarChart3, Settings, ChevronDown, X,
  UserCircle, Briefcase, Zap, DollarSign, Package, Wallet, RefreshCw,
  FolderKanban, BookOpen, Shield, FileMinus, BookMarked, CalendarClock,
  FileSpreadsheet, Bell, UsersRound, KeyRound, Activity, ShieldCheck,
  GitBranch, ClipboardCheck, LifeBuoy, Accessibility, Gem, Sparkles,
} from "lucide-react";

// Small gem marker shown next to features that will become paid tiers later
// (fully usable now — free during launch).
function GemMark() {
  return (
    <span
      title="Free during launch · becomes a paid feature soon"
      aria-label="Premium feature, free during launch"
      style={{ display: "inline-flex", flexShrink: 0 }}
    >
      <Gem size={11} color="#A855F7" strokeWidth={2.2} />
    </span>
  );
}

type Child   = { label: string; href: string; icon: React.ElementType; requiredModule?: Module };
type Group   = { kind: "group"; key: string; label: string; icon: React.ElementType; children: Child[] };
type NavLink = { kind: "link"; label: string; href: string; icon: React.ElementType; requiredModule?: Module };
type Nav     = Group | NavLink;

const NAV: Nav[] = [
  { kind: "link",  label: "Dashboard",       href: "/",               icon: LayoutDashboard, requiredModule: "dashboard" },
  { kind: "group", key: "sales", label: "Sales & Invoices", icon: FileText,
    children: [
      { label: "Clients",          href: "/clients",          icon: Users,         requiredModule: "clients" },
      { label: "Quotations",       href: "/quotations",       icon: FileText,      requiredModule: "quotations" },
      { label: "Invoices",         href: "/invoices",         icon: Receipt,       requiredModule: "invoices" },
      { label: "Payment Receipts", href: "/payment-receipts", icon: CreditCard,    requiredModule: "receipts" },
      { label: "Credit Notes",    href: "/credit-notes",    icon: FileMinus,     requiredModule: "credit-notes" },
      { label: "Catalog",          href: "/catalog",          icon: BookMarked,    requiredModule: "catalog" },
      { label: "Recurring",        href: "/recurring-invoices", icon: CalendarClock, requiredModule: "recurring-invoices" },
      { label: "Reminders",        href: "/reminders",          icon: Bell,          requiredModule: "reminders" },
    ]},
  { kind: "group", key: "hr", label: "HR & Payroll", icon: Briefcase,
    children: [
      { label: "Employees", href: "/employees", icon: UserCircle, requiredModule: "employees" },
      { label: "Salary", href: "/salary", icon: DollarSign, requiredModule: "salary" },
    ]},
  { kind: "group", key: "finance", label: "Finance", icon: Wallet,
    children: [
      { label: "Transactions", href: "/transactions", icon: BookOpen, requiredModule: "transactions" },
      { label: "Subscriptions", href: "/subscriptions", icon: RefreshCw, requiredModule: "subscriptions" },
      { label: "Vendors", href: "/vendors", icon: Package, requiredModule: "vendors" },
    ]},
  { kind: "link",  label: "Projects",    href: "/projects",    icon: FolderKanban,    requiredModule: "projects" },
  { kind: "link",  label: "Reports",     href: "/reports",     icon: BarChart3,       requiredModule: "invoices" },
  { kind: "link",  label: "GST Returns", href: "/gst-report",  icon: FileSpreadsheet, requiredModule: "gst" },
  { kind: "link",  label: "Approvals",  href: "/approvals",   icon: ClipboardCheck,  requiredModule: "dashboard" },
  { kind: "link",  label: "Audit Log",   href: "/audit-logs",  icon: Shield,          requiredModule: "audit-logs" },
  { kind: "link",  label: "Help & Support", href: "/help/issues", icon: LifeBuoy,     requiredModule: "dashboard" },
  { kind: "group", key: "settings", label: "Settings", icon: Settings,
    children: [
      { label: "My Profile",    href: "/settings/profile",       icon: UserCircle,    requiredModule: "dashboard" },
      { label: "General",       href: "/settings",               icon: Settings,      requiredModule: "settings" },
      { label: "Users",         href: "/settings/users",         icon: UsersRound,    requiredModule: "settings" },
      { label: "Roles",         href: "/settings/roles",         icon: KeyRound,      requiredModule: "settings" },
      { label: "Workflows",     href: "/settings/workflows",     icon: GitBranch,     requiredModule: "settings" },
      { label: "Activity Logs", href: "/settings/activity-logs", icon: Activity,      requiredModule: "settings" },
      { label: "Security",      href: "/settings/security",      icon: ShieldCheck,   requiredModule: "settings" },
      { label: "Privacy & Data", href: "/settings/privacy",      icon: ShieldCheck,   requiredModule: "settings" },
      { label: "API Keys",      href: "/settings/api-keys",      icon: KeyRound,      requiredModule: "settings" },
      { label: "Accessibility", href: "/settings/accessibility", icon: Accessibility, requiredModule: "settings" },
    ]},
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { permissions, isSystemAdmin } = usePermissions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sales: true, hr: true, finance: true, settings: false });

  // Live premium set (from super-admin plan config); falls back to static defaults.
  const [premiumKeys, setPremiumKeys] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => setPremiumKeys(new Set<string>(d.premium ?? [])))
      .catch(() => {});
  }, []);

  function isPremium(mod?: Module): boolean {
    if (!mod) return false;
    if (!premiumKeys) return isPremiumModule(mod);
    const key = MODULE_TO_FEATURE[mod];
    return key ? premiumKeys.has(key) : false;
  }

  const active = (href: string) => {
    if (href === "/" || href === "/settings") return pathname === href;
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) return true;
    return false;
  };

  function canViewModule(mod?: Module): boolean {
    if (!mod) return true;
    if (isSystemAdmin) return true;
    return hasPermission(permissions, mod, "view");
  }

  function filterNav(items: Nav[]): Nav[] {
    const result: Nav[] = [];
    for (const item of items) {
      if (item.kind === "group") {
        const visibleChildren = item.children.filter(c => canViewModule(c.requiredModule));
        if (visibleChildren.length > 0) {
          result.push({ ...item, children: visibleChildren });
        }
      } else {
        if (canViewModule(item.requiredModule)) {
          result.push(item);
        }
      }
    }
    return result;
  }

  const filteredNav = filterNav(NAV);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 lg:hidden"
          style={{
            zIndex: 40,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      <aside
        style={{
          width: 248,
          minWidth: 248,
          height: "100%",
          background: "#FFFFFF",
          borderRight: "1px solid #D1D5E0",
          boxShadow: open ? "4px 0 24px rgba(15,23,42,0.12)" : "2px 0 12px rgba(15,23,42,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 50,
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1), box-shadow 280ms",
        }}
        className={`fixed lg:static top-0 left-0 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
          }}>
            <Zap size={17} color="white" strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", lineHeight: 1 }}>QuoteGen</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginTop: 2 }}>Business Suite</div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex lg:hidden items-center justify-center transition-colors"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
              color: "#9CA3AF", cursor: "pointer", flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F0F2F8"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ height: 1, background: "#E8EAEF", margin: "0 14px 6px" }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "4px 10px 12px" }}>
          {filteredNav.map((item) => {
            if (item.kind === "group") {
              const anyActive = item.children.some(c => active(c.href));
              const isOpen = expanded[item.key] || anyActive;
              const Icon = item.icon;
              return (
                <div key={item.key} style={{ marginBottom: 1 }}>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [item.key]: !p[item.key] }))}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: anyActive ? "#EEF2FF" : "transparent",
                      fontSize: 13, fontWeight: 600,
                      color: anyActive ? "#4F46E5" : "#6B7280",
                      transition: "all 150ms",
                    }}
                    onMouseEnter={e => { if (!anyActive) (e.currentTarget as HTMLElement).style.background = "#F5F6FA"; }}
                    onMouseLeave={e => { if (!anyActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Icon size={15} strokeWidth={anyActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        color: "#C4C9D9",
                        transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 200ms ease",
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  <div style={{
                    overflow: "hidden",
                    maxHeight: isOpen ? 400 : 0,
                    opacity: isOpen ? 1 : 0,
                    transition: "max-height 220ms ease, opacity 180ms ease",
                  }}>
                    <div style={{
                      marginLeft: 16, paddingLeft: 12,
                      borderLeft: "2px solid #E8EAEF",
                      marginTop: 3, marginBottom: 4,
                    }}>
                      {item.children.map(child => {
                        const CIcon = child.icon;
                        const isActive = active(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "7px 10px", borderRadius: 7, marginBottom: 1,
                              fontSize: 13, fontWeight: isActive ? 600 : 400,
                              color: isActive ? "#4F46E5" : "#6B7280",
                              background: isActive ? "#EEF2FF" : "transparent",
                              textDecoration: "none", transition: "all 140ms",
                            }}
                            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "#F5F6FA"; (e.currentTarget as HTMLElement).style.color = "#374151"; } }}
                            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; } }}
                          >
                            <CIcon size={13.5} strokeWidth={isActive ? 2.2 : 1.7} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{child.label}</span>
                            {isPremium(child.requiredModule) && <GemMark />}
                            {isActive && (
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366F1", flexShrink: 0 }} />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8, marginBottom: 1,
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#4F46E5" : "#6B7280",
                  background: isActive ? "#EEF2FF" : "transparent",
                  textDecoration: "none", transition: "all 140ms",
                }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "#F5F6FA"; (e.currentTarget as HTMLElement).style.color = "#374151"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; } }}
              >
                <Icon size={15} strokeWidth={isActive ? 2.2 : 1.7} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {isPremium(item.requiredModule) && <GemMark />}
                {isActive && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366F1", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — launch offer + plans CTA */}
        <div style={{ padding: "8px 10px 14px" }}>
          <Link
            href="/plans"
            onClick={onClose}
            style={{
              display: "block", textDecoration: "none",
              background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)",
              border: "1px solid #DDD6FE", borderRadius: 10, padding: "10px 13px",
              transition: "border-color 150ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#A78BFA"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#DDD6FE"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} color="#7C3AED" strokeWidth={2.4} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", lineHeight: 1 }}>Free for 3 months</div>
            </div>
            <div style={{ fontSize: 11, color: "#8B5CF6", marginTop: 4 }}>Every feature unlocked. See plans →</div>
          </Link>
        </div>
      </aside>
    </>
  );
}
