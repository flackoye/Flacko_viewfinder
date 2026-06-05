'use client';

import { useState } from 'react';
import {
  MapPin, GraduationCap, Sparkles, Mail,
  Code2, Globe, Database, ExternalLink, Link2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import Image from 'next/image';
import ScrollReveal from '@/components/ScrollReveal';

/* ── 数据 ── */

const skillGroups = [
  { label: '语言', icon: Code2, skills: ['Python', 'C/C++', 'TypeScript'] },
  { label: '前端', icon: Globe, skills: ['React', 'Next.js', 'Tailwind CSS'] },
  { label: '数据科学', icon: Database, skills: ['NumPy', 'Pandas'] },
];

const currentlyDoing = [
  { emoji: '🏗️', text: '搭建个人网站' },
  { emoji: '🤖', text: '探索 AI 应用开发' },
  { emoji: '📚', text: '大二 · 计算机科学' },
];

const interests = ['人工智能', '开源社区', '创意编程', '音乐'];

/**
 * 收藏网址 — 先放占位数据，之后替换真实链接
 * 默认只展示前 4 个，点击展开按钮显示剩余
 */
const bookmarks = [
  { name: 'GitHub', url: 'https://github.com', desc: '代码托管', emoji: '🐙' },
  { name: 'Datawhale', url: 'https://www.datawhale.cn/', desc: '中文开源社区，教程与训练营', emoji: '🐋' },
  { name: '御舆', url: 'https://lintsinghua.github.io/#preface', desc: 'Claude Code 架构深度剖析', emoji: '🔍' },
  { name: 'Tcamp', url: 'https://tcamp.qq.com/', desc: '腾讯青科实训营', emoji: '🐧' },
  { name: 'Vercel', url: 'https://vercel.com', desc: '部署平台', emoji: '▲' },
  { name: 'MDN', url: 'https://developer.mozilla.org', desc: 'Web 文档', emoji: '📖' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', desc: '开发者问答', emoji: '💡' },
  { name: 'Hugging Face', url: 'https://huggingface.co', desc: '模型社区', emoji: '🤗' },
];

const VISIBLE_COUNT = 4;

/* ── 页面 ── */

export default function AboutPage() {
  const [bookmarksExpanded, setBookmarksExpanded] = useState(false);

  const visibleBookmarks = bookmarksExpanded
    ? bookmarks
    : bookmarks.slice(0, VISIBLE_COUNT);

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-10rem)]">
      {/* ── 背景装饰 ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="gradient-orb gradient-orb-gold w-[350px] h-[350px] md:w-[500px] md:h-[500px] -top-24 -left-24" />
        <div className="gradient-orb gradient-orb-blue w-[280px] h-[280px] md:w-[400px] md:h-[400px] bottom-10 -right-20" />
        <div className="absolute inset-0 bg-grid-subtle" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* ═══════ Hero: 大头像 + 身份 ═══════ */}
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10 mb-12">
            {/* 头像 — 带渐变光环 */}
            <div className="relative shrink-0">
              <div className="absolute inset-[-4px] rounded-full bg-gradient-to-br from-accent/60 via-accent/20 to-blue-400/40 blur-sm" />
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden ring-2 ring-white/10">
                <Image
                  src="/avatar.jpg"
                  alt="Bohao Fang"
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
            {/* 名字 + 标签 */}
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3">
                <span className="gradient-text">Cuhk_Chasing</span>
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 glass px-3 py-1 rounded-full text-accent-light">
                  <MapPin className="w-3.5 h-3.5" /> CUMT · CS
                </span>
                <span className="inline-flex items-center gap-1.5 glass px-3 py-1 rounded-full text-text-muted">
                  <GraduationCap className="w-3.5 h-3.5" /> 大二在读
                </span>
                <span className="inline-flex items-center gap-1.5 glass px-3 py-1 rounded-full text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Available
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* 简介 */}
        <ScrollReveal delay={60}>
          <p className="text-text-muted leading-relaxed text-lg md:text-xl max-w-2xl mb-14">
            努力为网站接入自己的知识库中.....
          </p>
        </ScrollReveal>

        {/* ═══════ Bento Grid ═══════ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 mb-12">

          {/* ── 当前在做 (占 2 列) ── */}
          <ScrollReveal delay={0} className="md:col-span-2">
            <div className="glass p-6 hover-lift h-full">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text-muted uppercase tracking-widest">当前在做</span>
              </div>
              <div className="space-y-3">
                {currentlyDoing.map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-lg shrink-0">{item.emoji}</span>
                    <span className="text-text-muted text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* ── 兴趣 (占 2 列) ── */}
          <ScrollReveal delay={120} className="md:col-span-2">
            <div className="glass p-6 hover-lift h-full">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text-muted uppercase tracking-widest">兴趣领域</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {interests.map((item) => (
                  <span
                    key={item}
                    className="skill-tag text-sm hover-lift cursor-default"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* ── 技术栈 (全宽 4 列) ── */}
          <ScrollReveal delay={180} className="md:col-span-4">
            <div className="glass p-6 hover-lift">
              <div className="flex items-center gap-2 mb-5">
                <Code2 className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text-muted uppercase tracking-widest">技术栈</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {skillGroups.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div key={group.label}>
                      <div className="skill-group-header flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-accent/60" />
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {group.skills.map((s) => (
                          <span key={s} className="skill-tag">{s}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>

          {/* ── 收藏网址 (全宽 4 列，可交互展开) ── */}
          <ScrollReveal delay={240} className="md:col-span-4">
            <div className="glass p-6 hover-lift">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-text-muted uppercase tracking-widest">收藏网址</span>
                </div>
                <span className="text-xs text-text-dim">{bookmarks.length} 个收藏</span>
              </div>

              {/* 网址网格 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {visibleBookmarks.map((bm) => (
                  <a
                    key={bm.name}
                    href={bm.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition-all duration-200 hover:scale-[1.02]"
                  >
                    <span className="text-xl shrink-0">{bm.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-text group-hover:text-accent-light transition-colors truncate">
                        {bm.name}
                      </p>
                      <p className="text-xs text-text-dim truncate">{bm.desc}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* 展开 / 收起 按钮 */}
              {bookmarks.length > VISIBLE_COUNT && (
                <button
                  onClick={() => setBookmarksExpanded(!bookmarksExpanded)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 text-sm text-text-dim hover:text-accent transition-colors rounded-xl hover:bg-white/[0.03]"
                >
                  {bookmarksExpanded ? (
                    <>
                      收起 <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      还有 {bookmarks.length - VISIBLE_COUNT} 个 <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </ScrollReveal>

          {/* ── 社交链接 (占 2 列) ── */}
          <ScrollReveal delay={300} className="md:col-span-2">
            <div className="glass p-6 hover-lift h-full">
              <div className="flex items-center gap-2 mb-5">
                <ExternalLink className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text-muted uppercase tracking-widest">找到我</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/flackoye"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-btn-outline w-12 h-12 rounded-full flex items-center justify-center hover-lift"
                  aria-label="GitHub"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
                <a
                  href="mailto:contact@flacko.dev"
                  className="glass-btn-outline w-12 h-12 rounded-full flex items-center justify-center hover-lift"
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* ── 格言 (占 2 列) ── */}
          <ScrollReveal delay={360} className="md:col-span-2">
            <div className="glass p-6 hover-lift h-full flex flex-col justify-center">
              <p className="text-text-muted text-lg md:text-xl font-medium italic">
                &ldquo;上坡要努力，下坡要开心&rdquo;
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
