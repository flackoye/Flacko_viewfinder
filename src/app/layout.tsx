import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC, Dancing_Script } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import fs from "fs";
import path from "path";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SettingsProvider } from "@/components/SettingsProvider";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import CursorEffect from "@/components/CursorEffect";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sans-sc",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  weight: "700",
});

export const metadata: Metadata = {
  title: "Flacko的取景框",
  // description: "个人知识库 — 学习、探索、创造",
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
  // 读取公告数据
  let announcement = null;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public', 'changelog.json'), 'utf-8');
    const data = JSON.parse(raw);
    announcement = data.announcement || null;
  } catch {
    // 文件不存在或解析失败 = 无公告
  }

  return (
    <html lang="zh-CN" className={`h-full antialiased ${inter.variable} ${notoSansSC.variable} ${dancingScript.variable}`}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <SettingsProvider>
          <Navbar />
          <main className="flex-1 pt-16">
            <AnnouncementBanner announcement={announcement} />
            {children}
          </main>
          <Footer />
        </SettingsProvider>
        <CursorEffect />
        <Analytics />
      </body>
    </html>
  );
}
