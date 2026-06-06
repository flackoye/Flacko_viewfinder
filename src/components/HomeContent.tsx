'use client';

import { useState } from 'react';
import Image from "next/image";
import Link from "next/link";
import { RefreshCw } from 'lucide-react';
import { fetchQuote, type Quote } from '@/lib/quotes';
import { useSettings } from '@/components/SettingsProvider';
import PetCharacter from '@/components/PetCharacter';

export default function HomeContent({ initialQuote }: { initialQuote: Quote }) {
  const [quote, setQuote] = useState(initialQuote);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  const handleNewQuote = async () => {
    setLoading(true);
    try {
      const newQuote = await fetchQuote();
      setQuote(newQuote);
    } finally {
      setLoading(false);
    }
  };

  // 拼接出处文字
  const sourceText = [quote.author, quote.from].filter(Boolean).join(' / ');

  return (
    <>
      {/* ========== 小宠物 ========== */}
      <PetCharacter />

      {/* ========== Hero 区域：动态背景 + 每日一言 ========== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* 背景图 — 所有参数由设置实时驱动 */}
        <div className="absolute inset-0">
          <Image
            src={settings.backgroundImage}
            alt="背景"
            fill
            className="object-cover"
            style={{
              objectPosition: 'center 35%',
              filter: `brightness(${settings.brightness / 100})`,
            }}
            priority
          />
          {/* 渐变遮罩 */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-bg to-bg"
            style={{ opacity: settings.overlayOpacity / 100 }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent" />
        </div>

        {/* 内容 */}
        <div className="relative z-10 text-center px-6 max-w-2xl">
          {/* 每日一言标签 */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-text-muted mb-8 hover-lift"
            style={{
              backdropFilter: `blur(${8 + settings.cardGlass / 5}px) saturate(1.2)`,
              background: `rgba(255,255,255,${settings.cardGlass / 1200})`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            每日一言
          </div>

          {/* 名言 */}
          <blockquote className="mb-6">
            <p className="text-2xl md:text-3xl font-medium leading-relaxed text-text/90 mb-4">
              {quote.text}
            </p>
            {sourceText && (
              <cite className="text-sm text-text-muted not-italic">
                —— {sourceText}
              </cite>
            )}
          </blockquote>

          {/* 换一句 */}
          <button
            onClick={handleNewQuote}
            disabled={loading}
            className="glass-btn-outline px-4 py-2 text-sm inline-flex items-center gap-2 hover-lift disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '获取中...' : '换一句'}
          </button>

          {/* 导航按钮 */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link href="/notes" className="glass-btn px-6 py-3 font-medium hover-lift">
              浏览笔记
            </Link>
            <Link href="/changelog" className="glass-btn-outline px-6 py-3 font-medium hover-lift">
              日志公告
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
