import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import { A11Y_NOFLASH_SCRIPT } from "@/lib/accessibility";

export const metadata: Metadata = {
  title: "QuoteGen – Business Management Suite",
  description: "Quotation, invoice, HR, finance, and project management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Apply saved accessibility prefs before paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_NOFLASH_SCRIPT }} />
      </head>
      <body className="h-full antialiased">
        <AccessibilityProvider>
          <ToastProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ToastProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
