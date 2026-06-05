import fs from 'fs';
import path from 'path';
import TimelineView from '@/components/TimelineView';

export default async function TrendingPage() {
  // 从 public/trending.json 读取数据（由 Python 管道生成）
  const filePath = path.join(process.cwd(), 'public', 'trending.json');

  let items = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    items = JSON.parse(raw);
  } catch {
    // JSON 文件不存在或为空（管道还没跑过）
  }

  // 转换时间字符串为 Date 对象，只展示得分 >= 6.0 的内容
  const parsed = items
    .map((item: Record<string, unknown>) => ({
      ...item,
      timestamp: new Date(item.timestamp as string),
    }))
    .filter((item: Record<string, unknown>) => {
      const score = item.score ?? item.llm_score ?? 0;
      return Number(score) >= 6.0;
    });

  return <TimelineView items={parsed} />;
}
