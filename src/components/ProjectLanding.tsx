'use client';

import Link from 'next/link';
import { FolderGit2, Layers, Database, Box, ArrowRight, Compass, MessageSquare, Palette } from 'lucide-react';
import type { CategoryInfo } from '@/lib/project-types';
import ScrollReveal from '@/components/ScrollReveal';
import BackgroundCanvas, { BG_PRESETS } from '@/components/StarfieldBackground';
import { useState, useEffect } from 'react';

interface ProjectLandingProps {
  totalProjects: number;
  totalChunks: number;
  dimension: number;
  generatedAt: string;
  categories: CategoryInfo[];
}

/** Gemini 风格四角星 */
function GeminiStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill="url(#gemini-grad)"
      />
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#667eea" />
          <stop offset="0.5" stopColor="#002FA7" />
          <stop offset="1" stopColor="#764ba2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** 管道步骤配置 */
const PIPELINE_STEPS = [
  { icon: '🐙', label: '数据采集', desc: 'GitHub Search API' },
  { icon: '✂️', label: '文本分块', desc: 'Markdown 感知切割' },
  { icon: '🧮', label: '向量化', desc: 'Embedding-3 · 512 维' },
  { icon: '🎯', label: '语义检索', desc: 'Cosine Top-K' },
  { icon: '🤖', label: '智能生成', desc: 'GLM 流式输出' },
];

export default function ProjectLanding({
  totalProjects,
  totalChunks,
  dimension,
  generatedAt,
  categories,
}: ProjectLandingProps) {
  const [bgIdx, setBgIdx] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-bg');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const bgPreset = BG_PRESETS[bgIdx];

  useEffect(() => {
    localStorage.setItem('projects-bg', String(bgIdx));
  }, [bgIdx]);

  const maxCount = Math.max(...categories.map(c => c.projectCount), 1);
  const stats = [
    { icon: FolderGit2, value: totalProjects, label: 'AI 开源项目' },
    { icon: Layers, value: categories.length, label: '技术分类' },
    { icon: Database, value: totalChunks.toLocaleString(), label: '知识片段' },
    { icon: Box, value: dimension, label: '维语义向量' },
  ];

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-10rem)]">
      {/* 背景画布 */}
      <BackgroundCanvas presetName={bgPreset.name} />

      {/* 背景切换器（仅落地页） */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="glass px-2 py-1.5 rounded-xl flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-text-dim" />
          {BG_PRESETS.map((p, idx) => (
            <button
              key={p.name}
              onClick={() => setBgIdx(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                idx === bgIdx
                  ? 'bg-klein/20 text-klein-light border border-klein/30'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 装饰光晕 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="gradient-orb gradient-orb-gold w-[350px] h-[350px] md:w-[500px] md:h-[500px] -top-24 -left-24 opacity-50" />
        <div className="gradient-orb gradient-orb-blue w-[280px] h-[280px] md:w-[400px] md:h-[400px] bottom-10 -right-20 opacity-50" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* ═══ Hero ═══ */}
        <ScrollReveal>
          <div className="text-center mb-14">
            <GeminiStar className="w-16 h-16 mx-auto mb-6 gemini-star" />
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="klein-gradient-text">万象索骥</span>
            </h1>
            <p className="text-text-muted text-lg md:text-xl max-w-xl mx-auto">
              基于 RAG 的 AI 开源项目智能导航系统
            </p>
          </div>
        </ScrollReveal>

        {/* ═══ Stats Bento Grid ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, idx) => (
            <ScrollReveal key={stat.label} delay={idx * 60}>
              <div className="glass p-5 text-center hover-lift">
                <stat.icon className="w-5 h-5 mx-auto mb-3 text-klein/70" />
                <div className="text-3xl md:text-4xl font-bold text-text leading-none mb-2">
                  {stat.value}
                </div>
                <div className="text-xs text-text-dim">{stat.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* ═══ 分类分布 ═══ */}
        <ScrollReveal delay={240}>
          <div className="glass p-6 mb-10 hover-lift">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-klein/70 text-sm">📊</span>
              <span className="text-sm font-medium text-text-muted uppercase tracking-widest">分类分布</span>
            </div>
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-sm shrink-0 w-5 text-center">{cat.emoji}</span>
                  <span className="text-sm text-text-muted w-28 shrink-0 truncate">{cat.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="category-bar"
                      style={{ width: `${(cat.projectCount / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-text-dim w-8 text-right shrink-0">
                    {cat.projectCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* ═══ 工作原理 ═══ */}
        <ScrollReveal delay={300}>
          <div className="glass p-6 mb-10 hover-lift">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-klein/70 text-sm">⚙️</span>
              <span className="text-sm font-medium text-text-muted uppercase tracking-widest">工作原理</span>
            </div>
            <div className="flex items-start justify-between gap-2 overflow-x-auto">
              {PIPELINE_STEPS.map((step, idx) => (
                <div key={step.label} className="pipeline-step">
                  <div className="pipeline-step-icon">
                    <span className="text-lg">{step.icon}</span>
                  </div>
                  <span className="text-xs font-medium text-text text-center">{step.label}</span>
                  <span className="text-[10px] text-text-dim text-center leading-tight">{step.desc}</span>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="hidden md:block absolute" />
                  )}
                </div>
              ))}
            </div>
            {generatedAt && (
              <p className="text-[10px] text-text-dim mt-4 text-center">
                索引构建于 {new Date(generatedAt).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        </ScrollReveal>

        {/* ═══ 模式选择 ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ScrollReveal delay={360}>
            <Link href="/projects/explore" className="block group">
              <div className="glass p-8 hover-lift h-full border-transparent hover:border-klein/25 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-klein/10 flex items-center justify-center">
                    <Compass className="w-5 h-5 text-klein-light" />
                  </div>
                  <h3 className="text-xl font-bold text-text group-hover:text-klein-light transition-colors">
                    引导探索
                  </h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  苏格拉底式对话，通过结构化问答逐步缩小范围，找到最适合你的 AI 开源项目
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm text-klein-light group-hover:gap-2.5 transition-all">
                  开始探索 <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={420}>
            <Link href="/projects/assistant" className="block group">
              <div className="glass p-8 hover-lift h-full border-transparent hover:border-accent/25 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-accent-light" />
                  </div>
                  <h3 className="text-xl font-bold text-text group-hover:text-accent-light transition-colors">
                    自由对话
                  </h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  直接描述你的需求，AI 即时检索并推荐相关项目，适合有明确目标的用户
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm text-accent-light group-hover:gap-2.5 transition-all">
                  开始对话 <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
