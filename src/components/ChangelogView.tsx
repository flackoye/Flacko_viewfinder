import { Sparkles, Wrench, ArrowUpRight, FileText, History } from 'lucide-react';

export interface ChangelogChange {
  type: 'feature' | 'fix' | 'improvement' | 'docs';
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangelogChange[];
}

// 变更类型 → 图标 + 颜色
const changeConfig: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  feature:     { label: '新功能', icon: Sparkles,    color: 'text-accent' },
  fix:         { label: '修复',   icon: Wrench,      color: 'text-[#54a0ff]' },
  improvement: { label: '优化',   icon: ArrowUpRight, color: 'text-[#2ecc71]' },
  docs:        { label: '文档',   icon: FileText,    color: 'text-text-muted' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ChangelogView({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-20 text-text-dim">
        <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg mb-2">暂无更新日志</p>
        <p className="text-sm">内容正在路上...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-3">
          <span className="gradient-text">更新日志</span>
        </h1>
        <p className="text-text-muted">记录站点的每一次进化</p>
      </div>

      {/* 时间线 */}
      <div className="relative">
        {/* 竖线 */}
        <div className="absolute left-[5px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-accent/40 via-border to-transparent" />

        {entries.map((entry) => (
          <div key={entry.version} className="flex gap-4 mb-8 group">
            {/* 时间轴圆点 */}
            <div className="flex flex-col items-center shrink-0 w-3 pt-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-accent opacity-60 group-hover:opacity-100 transition-opacity z-10" />
            </div>

            {/* 版本卡片 */}
            <div className="flex-1 glass p-5 hover-lift">
              {/* 版本号 + 日期 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="tag font-mono">{entry.version}</span>
                  <span className="text-text-dim text-sm">{formatDate(entry.date)}</span>
                </div>
              </div>

              {/* 标题 */}
              <h3 className="font-semibold text-text mb-3 text-lg">
                {entry.title}
              </h3>

              {/* 变更列表 */}
              <ul className="space-y-2">
                {entry.changes.map((change, i) => {
                  const config = changeConfig[change.type] || changeConfig.docs;
                  const Icon = config.icon;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.color}`} />
                      <span className="text-text-muted">{change.description}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
