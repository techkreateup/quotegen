import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Tamil, Fraunces } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const notoTamil = Noto_Sans_Tamil({ subsets: ["tamil", "latin"], weight: ["500", "700", "800"], variable: "--font-tamil", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz", "SOFT"] });
import { AuthProvider } from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { DialogProvider } from "@/components/Dialog";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import { A11Y_NOFLASH_SCRIPT } from "@/lib/accessibility";

export const metadata: Metadata = {
  title: "QuoteGen – Business Management Suite",
  description: "Quotation, invoice, HR, finance, and project management",
  icons: {
    icon: [
      { url: "/brand/quotegen/QG_icon_SVG.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "42x42", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "512x512" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${geist.variable} ${geistMono.variable} ${notoTamil.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved accessibility prefs before paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_NOFLASH_SCRIPT }} />
      </head>
      <body className="h-full antialiased">
        <AccessibilityProvider>
          <ToastProvider>
            <DialogProvider>
              <AuthProvider>
                <AppShell>{children}</AppShell>
              </AuthProvider>
            </DialogProvider>
          </ToastProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
