import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "katex/dist/katex.min.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SettingsProvider } from "@/components/SettingsProvider";
import CursorEffect from "@/components/CursorEffect";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Flacko的取景框",
  description: "Cuhk_Chasing 的个人网站",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <SettingsProvider>
          <Navbar />
          <main className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </SettingsProvider>
        <PageTransition />
        <CursorEffect />
        <Analytics />
      </body>
    </html>
  );
}
