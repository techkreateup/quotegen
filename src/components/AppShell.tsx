"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import TrialBanner from "@/components/TrialBanner";
import FeatureSpotlight from "@/components/FeatureSpotlight";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobOpen, setMobOpen] = useState(false);
  const [pageKey, setPageKey] = useState(pathname);

  useEffect(() => {
    setPageKey(pathname);
  }, [pathname]);

  const BARE_PATHS = ["/login", "/reset-password", "/signup", "/forgot-password", "/onboarding", "/landing", "/demo", "/features", "/solutions", "/security", "/pricing", "/terms", "/privacy", "/accept-terms"];
  if (
    BARE_PATHS.includes(pathname) ||
    pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/support" || pathname.startsWith("/support/")
  ) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg,#6366F1,#4F46E5)",
            boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
          }}>
            <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} />
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>Loading QuoteGen…</p>
        </div>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "clip", background: "var(--bg)" }}>
      <Sidebar open={mobOpen} onClose={() => setMobOpen(false)} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "clip" }}>
        <TopBar onMenuOpen={() => setMobOpen(true)} />

        <main style={{ flex: 1, overflowY: "auto" }}>
          <AnnouncementBanner />
          <TrialBanner />
          <EmailVerificationBanner />
          <div className="page-wrapper page-enter" key={pageKey}>
            {children}
          </div>
        </main>
      </div>
      <FeatureSpotlight />
    </div>
  );
}
