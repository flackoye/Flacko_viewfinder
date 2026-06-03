import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Customizer from "@/components/Customizer";
import { SettingsProvider } from "@/components/SettingsProvider";

export const metadata: Metadata = {
  title: "Flacko的取景框",
  description: "个人知识库 — 学习、探索、创造",
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
          <main className="flex-1 pt-16 page-fade-in">
            {children}
          </main>
          <Footer />
          <Customizer />
        </SettingsProvider>
      </body>
    </html>
  );
}
