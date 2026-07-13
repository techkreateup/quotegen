"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/components/AuthProvider";
import { hasPermission, type Module } from "@/lib/permissions";
import { isPremiumModule, MODULE_TO_FEATURE } from "@/lib/features";
import { CYCLE_STAGES } from "@/lib/cycle-config";

// Modules whose visibility is governed by the Business Setup (cycle config). Other
// modules (dashboard, settings, documents…) are never cycle-gated.
const CYCLE_CONTROLLED = new Set<string>(
  Object.values(CYCLE_STAGES).flat().map((s) => s.module).filter(Boolean) as string[]
);
import {
  LayoutDashboard, Users, FileText, Receipt, CreditCard,
  BarChart3, Settings, ChevronDown, X,
  UserCircle, Briefcase, DollarSign, Package, Wallet, RefreshCw,
  FolderKanban, BookOpen, Shield, FileMinus, BookMarked, CalendarClock,
  FileSpreadsheet, Bell, UsersRound, KeyRound, Activity, ShieldCheck,
  GitBranch, ClipboardCheck, LifeBuoy, Accessibility, Gem, Sparkles, Mail,
  PanelLeftClose, PanelLeftOpen, ClipboardList, Truck, TrendingUp, ShoppingCart, PackageCheck, Recycle,
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
      { label: "Sales Orders",     href: "/sales-orders",     icon: ClipboardList, requiredModule: "sales-orders" },
      { label: "Delivery Challans", href: "/delivery-challans", icon: Truck,        requiredModule: "delivery-challans" },
      { label: "Invoices",         href: "/invoices",         icon: Receipt,       requiredModule: "invoices" },
      { label: "Payment Receipts", href: "/payment-receipts", icon: CreditCard,    requiredModule: "receipts" },
      { label: "Credit Notes",    href: "/credit-notes",    icon: FileMinus,     requiredModule: "credit-notes" },
      { label: "Catalog",          href: "/catalog",          icon: BookMarked,    requiredModule: "catalog" },
      { label: "Inventory",        href: "/inventory",        icon: Package,       requiredModule: "catalog" },
      { label: "Recurring",        href: "/recurring-invoices", icon: CalendarClock, requiredModule: "recurring-invoices" },
      { label: "Reminders",        href: "/reminders",          icon: Bell,          requiredModule: "reminders" },
    ]},
  { kind: "group", key: "hr", label: "HR & Payroll", icon: Briefcase,
    children: [
      { label: "Employees", href: "/employees", icon: UserCircle, requiredModule: "employees" },
      { label: "Salary", href: "/salary", icon: DollarSign, requiredModule: "salary" },
      { label: "ID Cards", href: "/employees/id-cards", icon: UserCircle, requiredModule: "employees" },
      { label: "Assets", href: "/employee-assets", icon: Package, requiredModule: "assets" },
      { label: "Full & Final", href: "/fnf", icon: FileMinus, requiredModule: "fnf" },
    ]},
  { kind: "group", key: "finance", label: "Finance", icon: Wallet,
    children: [
      { label: "Transactions", href: "/transactions", icon: BookOpen, requiredModule: "transactions" },
      { label: "Vendors", href: "/vendors", icon: Package, requiredModule: "vendors" },
      { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, requiredModule: "purchase-orders" },
      { label: "Goods Receipts", href: "/goods-receipts", icon: PackageCheck, requiredModule: "goods-receipts" },
      { label: "Vendor Bills", href: "/purchase-bills", icon: Receipt, requiredModule: "purchase-bills" },
      { label: "Debit Notes", href: "/debit-notes", icon: FileMinus, requiredModule: "debit-notes" },
      { label: "Payables", href: "/payables", icon: Wallet, requiredModule: "vendors" },
      { label: "Payment Run", href: "/payables/pay-run", icon: DollarSign, requiredModule: "vendors" },
      { label: "Cash Command Center", href: "/cash", icon: TrendingUp, requiredModule: "dashboard" },
      { label: "Subscriptions", href: "/subscriptions", icon: RefreshCw, requiredModule: "subscriptions" },
    ]},
  { kind: "link",  label: "Sales Pipeline", href: "/pipeline",  icon: TrendingUp,      requiredModule: "dashboard" },
  { kind: "link",  label: "Documents",   href: "/documents",   icon: BookMarked,      requiredModule: "documents" },
  { kind: "link",  label: "Projects",    href: "/projects",    icon: FolderKanban,    requiredModule: "projects" },
  { kind: "link",  label: "Reports",     href: "/reports",     icon: BarChart3,       requiredModule: "invoices" },
  { kind: "link",  label: "GST Returns", href: "/gst-report",  icon: FileSpreadsheet, requiredModule: "gst" },
  { kind: "link",  label: "Follow-ups", href: "/follow-ups",  icon: CalendarClock,   requiredModule: "dashboard" },
  { kind: "link",  label: "Approvals",  href: "/approvals",   icon: ClipboardCheck,  requiredModule: "dashboard" },
  { kind: "link",  label: "Audit Log",   href: "/audit-logs",  icon: Shield,          requiredModule: "audit-logs" },
  { kind: "link",  label: "Recycle Bin",  href: "/recycle-bin", icon: Recycle,         requiredModule: "dashboard" },
  { kind: "link",  label: "Help & Support", href: "/help/issues", icon: LifeBuoy,     requiredModule: "dashboard" },
  { kind: "group", key: "settings", label: "Settings", icon: Settings,
    children: [
      { label: "My Profile",    href: "/settings/profile",       icon: UserCircle,    requiredModule: "dashboard" },
      { label: "General",       href: "/settings",               icon: Settings,      requiredModule: "settings" },
      { label: "Business Setup", href: "/settings/business-setup", icon: Sparkles,     requiredModule: "settings" },
      { label: "Users",         href: "/settings/users",         icon: UsersRound,    requiredModule: "settings" },
      { label: "Roles",         href: "/settings/roles",         icon: KeyRound,      requiredModule: "settings" },
      { label: "Workflows",     href: "/settings/workflows",     icon: GitBranch,     requiredModule: "settings" },
      { label: "Message Templates", href: "/settings/message-templates", icon: Mail,  requiredModule: "settings" },
      { label: "Activity Logs", href: "/settings/activity-logs", icon: Activity,      requiredModule: "settings" },
      { label: "Security",      href: "/settings/security",      icon: ShieldCheck,   requiredModule: "settings" },
      { label: "Privacy & Data", href: "/settings/privacy",      icon: ShieldCheck,   requiredModule: "settings" },
      { label: "API Keys",      href: "/settings/api-keys",      icon: KeyRound,      requiredModule: "settings" },
      { label: "Billing & Invoices", href: "/billing",           icon: Receipt,       requiredModule: "dashboard" },
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
  // Desktop icon-rail collapse (persisted). Mobile always opens full-width.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("qg_sidebar_collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("qg_sidebar_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // Live premium set (features that ARE paid in general) + the tenant's own
  // resolved feature map + their subscription status. Gem rules:
  //   · Paid customer with the feature: no gem (they've unlocked it).
  //   · Anyone else on a premium feature: show gem — including trial / Basic /
  //     Free-launch users so they see what will become paid.
  const [premiumKeys, setPremiumKeys] = useState<Set<string> | null>(null);
  const [ownedFeatures, setOwnedFeatures] = useState<Record<string, boolean> | null>(null);
  const [onPaidPlan, setOnPaidPlan] = useState(false);
  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => setPremiumKeys(new Set<string>(d.premium ?? [])))
      .catch(() => {});
    fetch("/api/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.error) return;
        setOwnedFeatures(d.features ?? {});
        // "Paid" = actively paying (ACTIVE) or in the paid-through grace of a
        // cancel (CANCELED). Trial/FREE/Basic users all see the gems.
        setOnPaidPlan(d.subscriptionStatus === "ACTIVE" || d.subscriptionStatus === "CANCELED");
      })
      .catch(() => {});
  }, []);

  // Business-setup enabled modules. null = not loaded yet → show everything (so
  // there's no flicker-to-hidden and existing tenants who never ran setup keep
  // full access — the API returns all-on for an empty config anyway).
  const [cycleModules, setCycleModules] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetch("/api/settings/business-setup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCycleModules(new Set<string>(d.enabledModules ?? [])))
      .catch(() => {});
  }, []);

  // Hide a stage module only when setup explicitly excludes it.
  function cycleHidden(mod?: Module): boolean {
    if (!mod || !cycleModules || !CYCLE_CONTROLLED.has(mod)) return false;
    return !cycleModules.has(mod);
  }

  function isPremium(mod?: Module): boolean {
    if (!mod) return false;
    const key = MODULE_TO_FEATURE[mod];
    if (!key) return false;
    // 1. Feature must be marked premium at the platform level.
    const platformPremium = premiumKeys ? premiumKeys.has(key) : isPremiumModule(mod);
    if (!platformPremium) return false;
    // 2. Paid customers only stop seeing gems for features they actually have.
    //    Trial / Free / Basic users still see gems on every premium feature —
    //    signals what will become paid once their window ends.
    if (onPaidPlan && ownedFeatures && ownedFeatures[key] === true) return false;
    return true;
  }

  // Pick the single best-matching link so a nested route (e.g. /payables/pay-run)
  // doesn't also light up its ancestor (/payables). Longest prefix wins; exact
  // match always wins over prefix.
  const bestActiveHref = useMemo(() => {
    const hrefs: string[] = [];
    for (const item of NAV) {
      if (item.kind === "link") hrefs.push(item.href);
      else for (const c of item.children) hrefs.push(c.href);
    }
    let best = "";
    for (const h of hrefs) {
      if (pathname === h) return h;
      if (pathname.startsWith(h + "/") && h.length > best.length) best = h;
    }
    return best;
  }, [pathname]);

  const active = (href: string) => {
    if (href === "/" || href === "/settings") return pathname === href;
    return href === bestActiveHref;
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
        const visibleChildren = item.children.filter(c => canViewModule(c.requiredModule) && !cycleHidden(c.requiredModule));
        if (visibleChildren.length > 0) {
          result.push({ ...item, children: visibleChildren });
        }
      } else {
        if (canViewModule(item.requiredModule) && !cycleHidden(item.requiredModule)) {
          result.push(item);
        }
      }
    }
    return result;
  }

  const filteredNav = filterNav(NAV);
  // Icon-rail only on desktop; a mobile-opened drawer is always full width.
  const rail = collapsed && !open;
  const flatItems = filteredNav.flatMap((i) => (i.kind === "group" ? i.children : [i]));

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
          width: rail ? 74 : 248,
          minWidth: rail ? 74 : 248,
          height: "100%",
          background: "#FFFFFF",
          borderRight: "1px solid #D1D5E0",
          boxShadow: open ? "4px 0 24px rgba(15,23,42,0.12)" : "2px 0 12px rgba(15,23,42,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 50,
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1), box-shadow 280ms, width 220ms ease, min-width 220ms ease",
        }}
        className={`fixed lg:static top-0 left-0 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div style={{ padding: rail ? "18px 0 14px" : "18px 16px 14px", display: "flex", alignItems: "center", justifyContent: rail ? "center" : "flex-start", gap: 10 }}>
          {rail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/brand/quotegen/QG_icon_SVG.svg" alt="QuoteGen"
                 style={{ width: 36, height: 36, flexShrink: 0, display: "block" }} />
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/quotegen/QGF_wordmark_SVG.svg" alt="QuoteGen"
                   style={{ height: 28, width: "auto", display: "block" }} />
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginTop: 4 }}>Business Suite</div>
            </div>
          )}

          {/* Desktop collapse toggle */}
          {!rail && (
            <button
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="hidden lg:flex items-center justify-center transition-colors"
              style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F0F2F8"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}
            >
              <PanelLeftClose size={16} />
            </button>
          )}

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

        {/* Expand toggle (shown when collapsed) */}
        {rail && (
          <button
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="hidden lg:flex items-center justify-center"
            style={{ width: 34, height: 30, margin: "0 auto 4px", borderRadius: 8, border: "none", background: "#F0F2F8", color: "#6B7280", cursor: "pointer" }}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        <div style={{ height: 1, background: "#E8EAEF", margin: "0 14px 6px" }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: rail ? "4px 0 12px" : "4px 10px 12px" }}>
          {rail && flatItems.map((child) => {
            const CIcon = child.icon;
            const isActive = active(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onClose}
                title={child.label}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 44, height: 40, margin: "2px auto", borderRadius: 9,
                  color: isActive ? "#4F46E5" : "#6B7280",
                  background: isActive ? "#EEF2FF" : "transparent",
                  textDecoration: "none", transition: "all 140ms", position: "relative",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#F5F6FA"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <CIcon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              </Link>
            );
          })}
          {!rail && filteredNav.map((item) => {
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
        <div style={{ padding: rail ? "8px 0 14px" : "8px 10px 14px" }}>
          {rail ? (
            <Link href="/plans" onClick={onClose} title="Plans — Free for 3 months"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 40, margin: "0 auto", borderRadius: 9, background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)", border: "1px solid #DDD6FE", textDecoration: "none" }}>
              <Sparkles size={16} color="#7C3AED" strokeWidth={2.4} />
            </Link>
          ) : (
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
          )}
        </div>
      </aside>
    </>
  );
}
