'use client';

import { useState } from 'react';
import { MessageSquare, FileText, ArrowUpRight, Star, Code2, Globe } from 'lucide-react';

export interface TrendingItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  source_type: string;
  timestamp: Date;
  score?: number;
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

type TabKey = 'all' | 'today' | 'leaderboard';

export default function TimelineView({ items }: { items: TrendingItem[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // 判断是否为今天
  const todayKey = formatDateKey(new Date());
  const todayItems = items.filter((item) => formatDateKey(item.timestamp) === todayKey);

  // 贡献榜：按来源统计数量，取前 2 名
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
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 2);

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
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-3">
          <span className="gradient-text">AI 热点</span>
        </h1>
        <p className="text-text-muted">LLM 筛选 · 每 12 小时更新 · 6 源聚合 · 保留最近 5 天</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-8 p-1 glass rounded-xl w-fit">
        {([
          { key: 'all' as TabKey, label: '全部热点' },
          { key: 'today' as TabKey, label: '今日热点' },
          { key: 'leaderboard' as TabKey, label: '热点贡献榜' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-accent text-bg shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 贡献榜面板 */}
      {activeTab === 'leaderboard' ? (
        <div className="space-y-4">
          {topSources.length === 0 ? (
            <div className="text-center py-20 text-text-dim">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">暂无数据</p>
            </div>
          ) : (
            topSources.map(([source, stat], idx) => {
              const config = getTypeConfig(stat.source_type);
              const Icon = config.icon;
              const medal = idx === 0 ? '🥇' : '🥈';
              const barWidth = topSources[0]
                ? `${(stat.count / topSources[0][1].count) * 100}%`
                : '0%';

              return (
                <div key={source} className="glass p-5 flex items-center gap-4">
                  <span className="text-2xl">{medal}</span>
                  <Icon className={`w-5 h-5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-text truncate">{source}</span>
                      <span className="text-sm font-mono text-accent whitespace-nowrap ml-2">
                        {stat.count} 条
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent/60 transition-all duration-500"
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : displayItems.length === 0 ? (
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
                            {item.score.toFixed(1)}
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
