'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, FileText, ArrowUpRight, Star, Code2, Globe, Flame, Sparkles, Trophy } from 'lucide-react';

export interface TrendingItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  source_type: string;
  timestamp: Date;
  score?: number;
  frontier?: number;
  signal?: number;
  llm_summary?: string;
  llm_tags?: string[];
  llm_reason?: string;
  thumbnail?: string;
  authors?: string;
  citations?: number;
  stars?: number;
  language?: string;
  tags?: string[];
}

// 根据 source_type 配置图标和颜色
const typeConfig: Record<string, { label: string; icon: typeof Globe; color: string; dotColor: string }> = {
  official_blog: { label: '官方博客', icon: Globe, color: 'text-accent', dotColor: 'bg-accent' },
  tech_blog: { label: '技术博客', icon: Code2, color: 'text-[#ff9f43]', dotColor: 'bg-[#ff9f43]' },
  tech_media: { label: '科技媒体', icon: MessageSquare, color: 'text-[#54a0ff]', dotColor: 'bg-[#54a0ff]' },
  tech_community: { label: '社区', icon: MessageSquare, color: 'text-[#ff6b6b]', dotColor: 'bg-[#ff6b6b]' },
  paper: { label: '论文', icon: FileText, color: 'text-[#5f27cd]', dotColor: 'bg-[#5f27cd]' },
  open_source: { label: '开源', icon: Star, color: 'text-[#2ecc71]', dotColor: 'bg-[#2ecc71]' },
  default: { label: '资讯', icon: ArrowUpRight, color: 'text-text-muted', dotColor: 'bg-text-muted' },
};

function getTypeConfig(sourceType: string) {
  return typeConfig[sourceType] || typeConfig.default;
}

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** 根据当前时间计算下次更新时间（CI cron: UTC 0:00 / 12:00 → 北京时间 08:00 / 20:00） */
function getNextUpdateTime(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const target = new Date(now);

  if (utcHour < 12) {
    target.setUTCHours(12, 0, 0, 0);
  } else {
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(0, 0, 0, 0);
  }

  const h = target.getHours().toString().padStart(2, '0');
  const m = target.getMinutes().toString().padStart(2, '0');
  const isToday = target.toDateString() === now.toDateString();

  return `${isToday ? '今天' : '明天'} ${h}:${m}`;
}

export default function TimelineView({ items }: { items: TrendingItem[] }) {
  const [activeTab, setActiveTab] = useState<'all' | 'today'>('all');
  const [nextUpdate, setNextUpdate] = useState('');

  useEffect(() => {
    setNextUpdate(getNextUpdateTime());
    const timer = setInterval(() => setNextUpdate(getNextUpdateTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 判断是否为今天
  const todayKey = formatDateKey(new Date());
  const todayItems = items.filter((item) => formatDateKey(item.timestamp) === todayKey);

  // 贡献榜：按来源统计数量
  const sourceStats = new Map<string, { count: number; source_type: string }>();
  for (const item of items) {
    const prev = sourceStats.get(item.source);
    if (prev) {
      prev.count++;
    } else {
      sourceStats.set(item.source, { count: 1, source_type: item.source_type });
    }
  }
  const topSources = [...sourceStats.entries()]
    .sort((a, b) => b[1].count - a[1].count);
  const uniqueSourceCount = topSources.length;

  // 按日期分组（根据 Tab 筛选）
  const displayItems = activeTab === 'today' ? todayItems : items;
  const grouped: { date: string; dateLabel: string; items: TrendingItem[] }[] = [];
  const dateMap = new Map<string, TrendingItem[]>();

  for (const item of displayItems) {
    const key = formatDateKey(item.timestamp);
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(item);
  }

  for (const [key, groupItems] of dateMap) {
    grouped.push({
      date: key,
      dateLabel: formatDate(groupItems[0].timestamp),
      items: groupItems,
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">AI 热点</span>
        </h1>
        {nextUpdate && (
          <span className="text-sm text-text-muted whitespace-nowrap">
            下次更新：{nextUpdate}
          </span>
        )}
      </div>

      {/* ========== 统计卡片 ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {/* 全部热点 */}
        <button
          onClick={() => setActiveTab('all')}
          className={`glass p-6 text-left transition-all duration-300 hover-lift group ${
            activeTab === 'all'
              ? 'ring-2 ring-accent/40 shadow-lg shadow-accent/10'
              : 'hover:ring-1 hover:ring-white/10'
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
            <Sparkles className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'all' ? 'text-accent' : ''}`} />
            <span className={activeTab === 'all' ? 'text-text' : ''}>全部热点</span>
          </div>
          <div className="text-5xl font-bold gradient-text leading-none">{items.length}</div>
          <div className="text-xs text-text-dim mt-3">{uniqueSourceCount} 源聚合 · 保留 5 天</div>
        </button>

        {/* 今日热点 */}
        <button
          onClick={() => setActiveTab('today')}
          className={`glass p-6 text-left transition-all duration-300 hover-lift group ${
            activeTab === 'today'
              ? 'ring-2 ring-accent/40 shadow-lg shadow-accent/10'
              : 'hover:ring-1 hover:ring-white/10'
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
            <Flame className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'today' ? 'text-accent' : ''}`} />
            <span className={activeTab === 'today' ? 'text-text' : ''}>今日热点</span>
          </div>
          <div className="text-5xl font-bold gradient-text leading-none">{todayItems.length}</div>
          <div className="text-xs text-text-dim mt-3">
            {todayItems.length > 0 ? '今日已更新' : '暂无今日更新'}
          </div>
        </button>

        {/* 热点贡献榜 */}
        <div className="glass p-6 hover-lift">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-text">热点贡献榜</span>
          </div>
          <div className="space-y-2.5">
            {topSources.slice(0, 5).map(([source, stat], idx) => {
              const maxCount = topSources[0]?.[1].count || 1;
              const barWidth = `${(stat.count / maxCount) * 100}%`;

              return (
                <div key={source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-sm min-w-0">
                      <span className="w-5 text-center shrink-0 text-xs">
                        {idx < 3 ? MEDALS[idx] : `${idx + 1}.`}
                      </span>
                      <span className="truncate text-text/80">{source}</span>
                    </span>
                    <span className="text-sm font-mono text-accent whitespace-nowrap ml-2">
                      {stat.count}
                    </span>
                  </div>
                  {/* 迷你进度条 */}
                  <div className="ml-7 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/40 transition-all duration-500"
                      style={{ width: barWidth }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========== 时间轴内容 ========== */}
      {displayItems.length === 0 ? (
        <div className="text-center py-20 text-text-dim">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">
            {activeTab === 'today' ? '今日暂无热点' : '暂无内容'}
          </p>
          {activeTab === 'all' && (
            <p className="text-sm">数据管道尚未运行，请先执行：
              <code className="ml-2 px-2 py-0.5 rounded bg-bg-card text-accent text-xs">
                python scripts/fetch_trending.py
              </code>
            </p>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* 时间轴主线 */}
          <div className="absolute left-[5px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-accent/40 via-border to-transparent" />

          {grouped.map((group) => (
            <div key={group.date} className="mb-12">
              {/* 日期标记 */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-3 h-3 rounded-full bg-accent border-2 border-bg z-10 shrink-0" />
                <span className="text-sm font-medium text-accent tracking-wide">
                  {group.dateLabel}
                </span>
              </div>

              {/* 该日期下的内容 */}
              {group.items.map((item) => {
                const config = getTypeConfig(item.source_type);
                const SourceIcon = config.icon;
                const displaySummary = item.llm_summary || item.summary;

                return (
                  <div key={item.id} className="flex gap-4 mb-6 group">
                    {/* 时间轴上的点 */}
                    <div className="flex flex-col items-center shrink-0 w-3 pt-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${config.dotColor} opacity-60 group-hover:opacity-100 transition-opacity z-10`}
                      />
                    </div>

                    {/* 时间 */}
                    <div className="shrink-0 w-12 pt-0.5">
                      <span className="text-xs text-text-dim font-mono">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    {/* 内容卡片 */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 glass p-5 hover-lift block"
                    >
                      {/* 头部：来源 + 标签 + 得分 */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <SourceIcon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
                          <span className="text-text-dim whitespace-nowrap">{item.source}</span>
                          {item.llm_tags && item.llm_tags.map((tag) => (
                            <span key={tag} className="tag text-[10px]">{tag}</span>
                          ))}
                          {item.language && (
                            <span className="tag text-[10px]">{item.language}</span>
                          )}
                        </div>
                        {item.score && (
                          <span className="text-xs font-mono text-accent whitespace-nowrap">
                            {Math.round(item.score)}
                          </span>
                        )}
                      </div>

                      {/* 标题 */}
                      <h3 className="font-semibold text-text mb-2 group-hover:text-accent transition-colors leading-snug">
                        {item.title}
                      </h3>

                      {/* LLM 摘要（优先）或原始摘要 */}
                      {displaySummary && (
                        <p className="text-sm text-text-muted leading-relaxed line-clamp-2 mb-2">
                          {displaySummary}
                        </p>
                      )}

                      {/* 底部信息 */}
                      <div className="flex items-center gap-3 text-xs text-text-dim mt-2">
                        {item.authors && <span>{item.authors}</span>}
                        {item.citations !== undefined && item.citations > 0 && (
                          <span>引用 {item.citations}</span>
                        )}
                        {item.stars !== undefined && item.stars > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3" />{item.stars}
                          </span>
                        )}
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
