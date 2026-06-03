/**
 * AI 热点爬取 — 数据获取 + 评分系统
 *
 * 数据源：
 * - HackerNews (HN Algolia API)
 * - Reddit (r/MachineLearning)
 * - arxiv (最新 AI 论文)
 *
 * 评分：来源可信度 × 热度归一化
 */

export interface TrendingItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: 'hackernews' | 'reddit' | 'arxiv';
  score: number;         // 最终得分 0~10
  rawPopularity: number; // 原始互动量
  timestamp: Date;
  thumbnail?: string;
  authors?: string;
  tags?: string[];
}

// ========== 来源可信度权重 ==========
const SOURCE_WEIGHT: Record<TrendingItem['source'], number> = {
  arxiv: 1.0,
  hackernews: 0.7,
  reddit: 0.5,
};

// ========== HackerNews ==========
interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

async function fetchHackerNews(): Promise<TrendingItem[]> {
  try {
    const res = await fetch(
      'https://hn.algolia.com/api/v1/search?query=AI+LLM+transformer+GPT&tags=story&hitsPerPage=20&numericFilters=points>10',
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error('HN API failed');
    const data = await res.json();

    return (data.hits as HNHit[]).map((hit) => ({
      id: `hn-${hit.objectID}`,
      title: hit.title || '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'hackernews' as const,
      score: 0,
      rawPopularity: (hit.points || 0) + (hit.num_comments || 0) * 0.5,
      timestamp: new Date(hit.created_at || Date.now()),
      tags: ['HN'],
    }));
  } catch {
    return [];
  }
}

// ========== Reddit ==========
interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    selftext?: string;
    score: number;
    num_comments: number;
    created_utc: number;
    thumbnail?: string;
    link_flair_text?: string;
  };
}

async function fetchReddit(): Promise<TrendingItem[]> {
  try {
    const res = await fetch('https://www.reddit.com/r/MachineLearning/hot.json?limit=15', {
      headers: { 'User-Agent': 'FlackoTrending/1.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('Reddit API failed');
    const data = await res.json();

    return (data.data.children as RedditPost[]).map((post) => {
      const p = post.data;
      // 过滤掉自述帖的缩略图（default/self/nsfw）
      const thumb = p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : undefined;

      return {
        id: `reddit-${p.id}`,
        title: p.title,
        summary: p.selftext ? p.selftext.slice(0, 200) : undefined,
        url: `https://www.reddit.com${p.url}`,
        source: 'reddit' as const,
        score: 0,
        rawPopularity: p.score + p.num_comments * 0.5,
        timestamp: new Date(p.created_utc * 1000),
        thumbnail: thumb,
        tags: p.link_flair_text ? [p.link_flair_text] : ['Reddit'],
      };
    });
  } catch {
    return [];
  }
}

// ========== arxiv ==========
interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  link?: { href: string };
  author?: { name: string }[];
  category?: { term: string }[];
}

async function fetchArxiv(): Promise<TrendingItem[]> {
  try {
    const res = await fetch(
      'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=15',
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error('arxiv API failed');
    const xml = await res.text();

    // 简单解析 XML（不引入额外依赖）
    const entries: TrendingItem[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const getText = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim().replace(/\n/g, ' ') : '';
      };

      const id = getText('id');
      const title = getText('title');
      const summary = getText('summary').slice(0, 300);
      const published = getText('published');

      // 提取作者
      const authorRegex = /<name>(.*?)<\/name>/g;
      const authors: string[] = [];
      let authorMatch;
      while ((authorMatch = authorRegex.exec(block)) !== null) {
        authors.push(authorMatch[1].trim());
      }

      // 提取分类
      const catRegex = /category[^>]*term="([^"]+)"/g;
      const categories: string[] = [];
      let catMatch;
      while ((catMatch = catRegex.exec(block)) !== null) {
        categories.push(catMatch[1].replace('cs.', ''));
      }

      entries.push({
        id: `arxiv-${id}`,
        title,
        summary,
        url: id.replace('http://', 'https://').replace('/abs/', '/abs/'),
        source: 'arxiv',
        score: 0,
        rawPopularity: 0, // arxiv 没有点赞数据，靠来源权重
        timestamp: new Date(published),
        authors: authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' et al.' : ''),
        tags: [...new Set(categories)].slice(0, 3),
      });
    }

    return entries;
  } catch {
    return [];
  }
}

// ========== 评分引擎 ==========

/** 将一组数值归一化到 0~1 */
function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

/** 按来源分组归一化，再乘以来源权重，得到最终 0~10 分 */
function scoreItems(items: TrendingItem[]): TrendingItem[] {
  // 按来源分组
  const groups: Record<string, TrendingItem[]> = {};
  for (const item of items) {
    if (!groups[item.source]) groups[item.source] = [];
    groups[item.source].push(item);
  }

  // 每个来源内部归一化
  for (const [source, group] of Object.entries(groups)) {
    const popularities = group.map((i) => i.rawPopularity);
    const normalized = normalize(popularities);
    const weight = SOURCE_WEIGHT[source as TrendingItem['source']];

    group.forEach((item, i) => {
      // arxiv 没有互动量数据，给一个基础分 + 时间新鲜度加分
      if (source === 'arxiv') {
        const hoursAgo = (Date.now() - item.timestamp.getTime()) / 3600000;
        const freshness = Math.max(0, 1 - hoursAgo / 168); // 7 天内衰减
        item.score = Math.round((0.5 + freshness * 0.5) * weight * 10 * 10) / 10;
      } else {
        item.score = Math.round(normalized[i] * weight * 10 * 10) / 10;
      }
    });
  }

  return items;
}

// ========== 主入口 ==========

/** 获取所有来源数据并评分 */
export async function fetchTrending(): Promise<TrendingItem[]> {
  const [hn, reddit, arxiv] = await Promise.all([
    fetchHackerNews(),
    fetchReddit(),
    fetchArxiv(),
  ]);

  const all = [...hn, ...reddit, ...arxiv];
  const scored = scoreItems(all);

  // 过滤：只保留得分 >= 3 的
  const filtered = scored.filter((item) => item.score >= 3.0);

  // 按时间倒序
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return filtered;
}
