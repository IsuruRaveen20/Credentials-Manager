import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { AccessProvider } from "@/lib/access";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VaultOps · WebMee",
  description: "WebMee internal encrypted credentials vault. Invite-only — no public registration.",
  authors: [{ name: "Isuru Raveen", url: "mailto:isururaveen4520@gmail.com" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <AppProviders>
          <ThemeProvider>
            <ToastProvider>
              <AccessProvider>{children}</AccessProvider>
            </ToastProvider>
          </ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
