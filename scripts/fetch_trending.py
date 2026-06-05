"""
AI 热点爬取管道
=================

流程：
1. 从多个数据源爬取内容（RSS + Semantic Scholar + GitHub Trending）
2. 调用 GLM API 对每条内容进行筛选、打分、生成摘要
3. 只保留得分 >= 阈值 的优质内容
4. 管理滚动窗口：自动删除超过指定天数的内容
5. 输出到 public/trending.json

所有配置均在项目根目录 .env 文件中管理，修改配置无需改代码。
模型文档: https://docs.bigmodel.cn/cn/guide/start/model-overview
"""

import json
import os
import sys
import io
import time
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree

# Windows 终端默认 GBK 编码无法输出 emoji，强制切换 UTF-8
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import feedparser
import httpx
from zai import ZhipuAiClient


# ========== 环境变量加载 ==========

def load_env():
    """自动加载项目根目录的 .env 文件"""
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_env()


# ========== 从环境变量读取配置（带默认值） ==========

def _env(key: str, default: str = "") -> str:
    """读取环境变量，去掉引号"""
    val = os.environ.get(key, default)
    return val.strip('"').strip("'")

# --- 输出 ---
OUTPUT_FILE = Path(__file__).parent.parent / "public" / "trending.json"

# --- 筛选规则 ---
MAX_AGE_DAYS = int(_env("MAX_AGE_DAYS", "3"))
SCORE_THRESHOLD = float(_env("SCORE_THRESHOLD", "6.0"))        # 展示门槛：只向前端展示这个分数以上的
SAVE_THRESHOLD = float(_env("SAVE_THRESHOLD", "4.0"))           # 入库门槛：低于此分数直接丢弃

# --- GLM 模型配置 ---
GLM_MODEL = _env("ZHIPU_MODEL", "glm-4.7-flash")
GLM_TEMPERATURE = float(_env("ZHIPU_TEMPERATURE", "0.1"))
GLM_MAX_TOKENS = int(_env("ZHIPU_MAX_TOKENS", "256"))

# --- 爬取控制 ---
RSS_ITEMS_PER_SOURCE = int(_env("RSS_ITEMS_PER_SOURCE", "5"))
LLM_CALL_INTERVAL = float(_env("LLM_CALL_INTERVAL", "0.5"))
HTTP_TIMEOUT = int(_env("HTTP_TIMEOUT", "15"))

# AI 领域优质 RSS 源
RSS_SOURCES = [
    {
        "name": "OpenAI Blog",
        "url": "https://openai.com/blog/rss.xml",
        "source_type": "official_blog",
    },
    {
        "name": "Anthropic Blog",
        "url": "https://www.anthropic.com/feed.xml",
        "source_type": "official_blog",
    },
    {
        "name": "Hugging Face Blog",
        "url": "https://huggingface.co/blog/feed.xml",
        "source_type": "tech_blog",
    },
    {
        "name": "DeepMind Blog",
        "url": "https://deepmind.google/blog/rss.xml",
        "source_type": "official_blog",
    },
    {
        "name": "MIT Tech Review AI",
        "url": "https://www.technologyreview.com/feed/",
        "source_type": "tech_media",
    },
    {
        "name": "36氪",
        "url": "https://36kr.com/feed",
        "source_type": "tech_media",
    },
]

# ========== 数据结构 ==========

def make_id(text: str) -> str:
    """根据文本生成唯一 ID"""
    return hashlib.md5(text.encode()).hexdigest()[:12]

# ========== 数据源 1: RSS ==========

def fetch_rss() -> list[dict]:
    """从 RSS 源获取最新文章"""
    items = []
    for source in RSS_SOURCES:
        try:
            resp = httpx.get(source["url"], timeout=HTTP_TIMEOUT, follow_redirects=True)
            feed = feedparser.parse(resp.text)

            for entry in feed.entries[:RSS_ITEMS_PER_SOURCE]:
                # 只保留最近 MAX_AGE_DAYS 天的
                published = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    published = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)

                if published and published < datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS):
                    continue
                if not published:
                    published = datetime.now(timezone.utc)

                items.append({
                    "id": make_id(entry.get("title", "") + source["name"]),
                    "title": entry.get("title", "").strip(),
                    "summary": entry.get("summary", "").strip()[:500],
                    "url": entry.get("link", ""),
                    "source": source["name"],
                    "source_type": source["source_type"],
                    "timestamp": published.isoformat(),
                })
        except Exception as e:
            print(f"  ⚠ RSS fetch failed for {source['name']}: {e}")
            continue

    print(f"  📡 RSS: fetched {len(items)} items")
    return items


# ========== 数据源 2: Semantic Scholar ==========

def fetch_semantic_scholar() -> list[dict]:
    """获取 AI 领域趋势论文（按引用速度排序）"""
    items = []
    try:
        three_days_ago = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).strftime("%Y-%m-%d")
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": "large language model OR transformer OR generative AI",
            "year": "2025-2026",
            "fields": "title,abstract,url,authors,publicationDate,citationCount",
            "limit": 10,
            "sort": "publicationDate:desc",
        }
        # Semantic Scholar 限流严格，加重试
        for attempt in range(3):
            resp = httpx.get(url, params=params, timeout=HTTP_TIMEOUT + 5)
            if resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  ⏳ Semantic Scholar 限流，等待 {wait}s 后重试...")
                time.sleep(wait)
                continue
            break
        data = resp.json()

        for paper in data.get("data", []):
            if not paper.get("title"):
                continue

            authors = []
            for a in (paper.get("authors") or [])[:3]:
                if a.get("name"):
                    authors.append(a["name"])

            items.append({
                "id": make_id(paper["title"]),
                "title": paper["title"].strip(),
                "summary": (paper.get("abstract") or "")[:300],
                "url": paper.get("url", ""),
                "source": "Semantic Scholar",
                "source_type": "paper",
                "timestamp": paper.get("publicationDate", datetime.now(timezone.utc).isoformat()),
                "authors": ", ".join(authors),
                "citations": paper.get("citationCount", 0),
            })
    except Exception as e:
        print(f"  ⚠ Semantic Scholar fetch failed: {e}")

    print(f"  📄 Semantic Scholar: fetched {len(items)} items")
    return items


# ========== 数据源 3: GitHub Trending (AI) ==========

def fetch_github_trending() -> list[dict]:
    """爬取 GitHub AI 相关 trending 仓库"""
    items = []
    try:
        # GitHub API 要求日期格式为 YYYY-MM-DD
        since = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).strftime("%Y-%m-%d")
        resp = httpx.get(
            "https://api.github.com/search/repositories",
            params={
                "q": f"AI OR LLM OR transformer created:>{since}",
                "sort": "stars",
                "order": "desc",
                "per_page": 15,
            },
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=HTTP_TIMEOUT,
        )
        data = resp.json()

        for repo in data.get("items", []):
            items.append({
                "id": make_id(repo["full_name"]),
                "title": f"{repo['full_name']} ⭐{repo['stargazers_count']}",
                "summary": (repo.get("description") or "")[:200],
                "url": repo["html_url"],
                "source": "GitHub",
                "source_type": "open_source",
                "timestamp": repo.get("created_at", datetime.now(timezone.utc).isoformat()),
                "stars": repo["stargazers_count"],
                "language": repo.get("language"),
            })
    except Exception as e:
        print(f"  ⚠ GitHub trending fetch failed: {e}")

    print(f"  🐙 GitHub: fetched {len(items)} items")
    return items


# ========== 数据源 4: HackerNews ==========

def fetch_hackernews() -> list[dict]:
    """从 HackerNews 获取 AI 相关热门帖子"""
    items = []
    try:
        resp = httpx.get(
            "https://hn.algolia.com/api/v1/search",
            params={
                "query": "AI OR LLM OR GPT OR transformer OR machine learning",
                "tags": "story",
                "hitsPerPage": 15,
                "numericFilters": "points>10",
            },
            timeout=HTTP_TIMEOUT,
        )
        data = resp.json()

        for hit in data.get("hits", []):
            title = (hit.get("title") or "").strip()
            if not title:
                continue

            created = hit.get("created_at", "")
            try:
                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except:
                ts = datetime.now(timezone.utc)

            # 只保留最近 MAX_AGE_DAYS 天的
            if ts < datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS):
                continue

            items.append({
                "id": make_id(title + "HN"),
                "title": title,
                "summary": f"HN 热度: {hit.get('points', 0)} 点赞, {hit.get('num_comments', 0)} 评论",
                "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}",
                "source": "HackerNews",
                "source_type": "tech_community",
                "timestamp": ts.isoformat(),
            })
    except Exception as e:
        print(f"  ⚠ HackerNews fetch failed: {e}")

    print(f"  🔶 HackerNews: fetched {len(items)} items")
    return items


# ========== 数据源 5: Reddit ==========

def fetch_reddit() -> list[dict]:
    """从 Reddit AI 相关子版获取热门帖子"""
    items = []
    subreddits = ["MachineLearning", "artificial", "LocalLLaMA", "singularity"]
    for sub in subreddits:
        try:
            resp = httpx.get(
                f"https://www.reddit.com/r/{sub}/hot.json",
                params={"limit": 8},
                headers={"User-Agent": "FlackoTrending/2.0"},
                timeout=HTTP_TIMEOUT,
            )
            if not resp.ok:
                continue
            data = resp.json()

            for post in data.get("data", {}).get("children", []):
                p = post["data"]
                title = (p.get("title") or "").strip()
                if not title or p.get("score", 0) < 10:
                    continue

                thumb = p.get("thumbnail", "")
                thumb = thumb if thumb.startswith("http") else None

                items.append({
                    "id": make_id(title + sub),
                    "title": title,
                    "summary": (p.get("selftext") or "")[:200] or None,
                    "url": f"https://www.reddit.com{p.get('permalink', '')}",
                    "source": f"r/{sub}",
                    "source_type": "tech_community",
                    "timestamp": datetime.fromtimestamp(p.get("created_utc", 0), tz=timezone.utc).isoformat(),
                    "thumbnail": thumb,
                    "tags": [p.get("link_flair_text")] if p.get("link_flair_text") else [sub],
                })
        except Exception as e:
            print(f"  ⚠ Reddit r/{sub} fetch failed: {e}")
            continue

    print(f"  💬 Reddit: fetched {len(items)} items")
    return items


# ========== LLM 筛选引擎 ==========

SYSTEM_PROMPT = """你是一个 AI 领域的内容筛选专家。你的任务是评估一条 AI 相关的内容是否值得推荐给一个正在学习 AI/LLM 的计算机专业学生。

评估标准（每项 0-10 分，取加权平均作为最终得分）：
1. **前沿性**（权重 30%）：内容是否涉及最新的 AI 技术进展？
2. **实用性**（权重 30%）：对学习者是否有实际参考价值？
3. **信息密度**（权重 25%）：内容是否有实质信息，而非空洞的 PR 或营销？
4. **可读性**（权重 15%）：标题和摘要是否清晰明了？

你需要返回一个 JSON 对象，格式如下：
{
  "relevant": true/false,
  "score": 精确到一位小数的得分，如 6.3、7.8、5.2，
  "one_line_summary": "一句话中文摘要，不超过40字",
  "tags": ["标签1", "标签2"],
  "reason": "简短的筛选理由"
}

重要规则：
- score 必须是一位小数，不要返回整数（如不要返回 6，要返回 6.0）
- 只要内容与 AI/LLM 稍微相关，relevant 就设为 true（由后续阈值过滤）

只返回 JSON，不要其他文字。"""

def llm_filter(client: ZhipuAiClient, item: dict) -> dict | None:
    """调用 GLM 对单条内容进行筛选"""
    user_msg = f"""请评估以下内容：

标题：{item['title']}
来源：{item['source']}
摘要：{item.get('summary', '无摘要')[:300]}

请给出评分和筛选结果。"""

    try:
        response = client.chat.completions.create(
            model=GLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=GLM_TEMPERATURE,
            max_tokens=GLM_MAX_TOKENS,
            # 关闭思维链 — 筛选任务不需要深度推理，避免 token 浪费在思考上
            thinking={"type": "disabled"},
        )

        raw = response.choices[0].message.content.strip()

        # 提取 JSON（可能被 ``` 包裹）
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)

        if not result.get("relevant", False):
            return None
        if result.get("score", 0) < SAVE_THRESHOLD:
            return None

        return {
            "llm_score": result["score"],
            "llm_summary": result.get("one_line_summary", ""),
            "llm_tags": result.get("tags", []),
            "llm_reason": result.get("reason", ""),
        }

    except json.JSONDecodeError:
        print(f"    ⚠ LLM 返回了非 JSON 内容，跳过: {item['title'][:40]}")
        print(f"       原始返回: {raw[:200]}")
        return None
    except Exception as e:
        print(f"    ⚠ LLM error: {e}")
        return None


# ========== 主流程 ==========

def load_existing_data() -> list[dict]:
    """加载已有数据"""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return []


def prune_old_items(items: list[dict]) -> list[dict]:
    """删除超过指定天数的内容"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    kept = []
    for item in items:
        try:
            ts = datetime.fromisoformat(item["timestamp"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts > cutoff:
                kept.append(item)
        except:
            kept.append(item)  # 解析不了时间的保留
    removed = len(items) - len(kept)
    if removed:
        print(f"  🗑 已清理 {removed} 条过期内容（>{MAX_AGE_DAYS}天）")
    return kept


def deduplicate(old_items: list[dict], new_items: list[dict]) -> list[dict]:
    """去重：跳过已有 ID 的内容"""
    existing_ids = {item["id"] for item in old_items}
    return [item for item in new_items if item["id"] not in existing_ids]


def main():
    print("=" * 50)
    print("🚀 AI 热点爬取管道启动")
    print(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   模型: {GLM_MODEL}")
    print(f"   入库门槛: {SAVE_THRESHOLD} | 展示门槛: {SCORE_THRESHOLD} | 保留: {MAX_AGE_DAYS}天")
    print("=" * 50)

    # 检查 API Key
    api_key = _env("ZHIPU_API_KEY")
    if not api_key:
        print("❌ 请在 .env 中设置 ZHIPU_API_KEY")
        sys.exit(1)

    client = ZhipuAiClient(api_key=api_key)

    # 1. 加载已有数据 + 清理过期
    existing = load_existing_data()
    existing = prune_old_items(existing)
    print(f"📂 已有 {len(existing)} 条内容")

    # 2. 爬取新内容
    print("\n📡 开始爬取...")
    raw_items = []
    raw_items.extend(fetch_rss())
    raw_items.extend(fetch_semantic_scholar())
    raw_items.extend(fetch_github_trending())
    raw_items.extend(fetch_hackernews())
    raw_items.extend(fetch_reddit())

    # 去重
    new_items = deduplicate(existing, raw_items)
    print(f"\n🔍 去重后新增 {len(new_items)} 条待筛选")

    if not new_items:
        print("✅ 没有新内容需要筛选")
    else:
        # 3. LLM 筛选
        print(f"\n🤖 开始 LLM 筛选（{len(new_items)} 条）...")
        filtered = []
        for i, item in enumerate(new_items):
            print(f"  [{i+1}/{len(new_items)}] {item['title'][:50]}...")
            llm_result = llm_filter(client, item)
            if llm_result:
                item.update(llm_result)
                item["score"] = llm_result["llm_score"]
                filtered.append(item)
                print(f"    ✅ 得分: {llm_result['llm_score']} | {llm_result['llm_summary']}")
            else:
                print(f"    ❌ 未通过筛选")
            time.sleep(LLM_CALL_INTERVAL)

        print(f"\n🎯 筛选结果: {len(filtered)}/{len(new_items)} 条通过")
        existing.extend(filtered)

    # 4. 按时间排序
    existing.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # 5. 写入文件
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\n💾 已保存 {len(existing)} 条内容到 {OUTPUT_FILE}")
    print("=" * 50)


if __name__ == "__main__":
    main()
