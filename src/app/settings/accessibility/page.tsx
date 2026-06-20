"use client";

import PageHeader from "@/components/PageHeader";
import AccessibilityControls from "@/components/AccessibilityControls";
import { Accessibility } from "lucide-react";

export default function AccessibilitySettingsPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Accessibility"
        subtitle="Adjust text size, contrast, motion and more — saved on this device for your account"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Accessibility" }]}
      />

      <div className="card" style={{ padding: 20, maxWidth: 560 }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}>
            <Accessibility size={13} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Display preferences</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>
              These settings apply instantly and are remembered on this device. They&apos;re also available
              anytime from the accessibility button in the bottom-left corner.
            </p>
          </div>
        </div>

        <AccessibilityControls />
      </div>
    </div>
  );
}
