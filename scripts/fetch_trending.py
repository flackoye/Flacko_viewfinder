"""
AI 热点爬取管道 v2（异步版）
============================

相比 v1 的优化：
1. asyncio + httpx.AsyncClient 并发爬取 — 爬取阶段 < 5s（原 4min+）
2. 线程池 + 信号量并发 LLM 筛选 — 筛选阶段 ~30s（原 3min+）
3. 精简数据源：6 源（原 21 源，其中 17 源零产出白跑）
4. 整体运行时间：6-8min → ~1-2min

数据源（v2 只保留有效源）：
  RSS:  OpenAI Blog, Hugging Face Blog, MIT Tech Review
  API:  GitHub Trending, HackerNews
  RSS:  Reddit（改用 .rss 替代需要 OAuth 的 JSON API）
"""

import asyncio
import json
import os
import sys
import io
import time
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

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


# ========== 配置 ==========

def _env(key: str, default: str = "") -> str:
    val = os.environ.get(key, default)
    return val.strip('"').strip("'")

OUTPUT_FILE = Path(__file__).parent.parent / "public" / "trending.json"

MAX_AGE_DAYS = int(_env("MAX_AGE_DAYS", "5"))
SCORE_THRESHOLD = float(_env("SCORE_THRESHOLD", "5.5"))
SAVE_THRESHOLD = float(_env("SAVE_THRESHOLD", "5.5"))

GLM_MODEL = _env("ZHIPU_MODEL", "glm-4.7-flash")
GLM_TEMPERATURE = float(_env("ZHIPU_TEMPERATURE", "0.1"))
GLM_MAX_TOKENS = int(_env("ZHIPU_MAX_TOKENS", "512"))

RSS_ITEMS_PER_SOURCE = int(_env("RSS_ITEMS_PER_SOURCE", "8"))
HTTP_TIMEOUT = int(_env("HTTP_TIMEOUT", "15"))
MIN_ITEMS_PER_UPDATE = int(_env("MIN_ITEMS_PER_UPDATE", "15"))

LLM_CONCURRENCY = 5  # 并发 LLM 调用上限


# ========== 精简数据源（v2） ==========

RSS_SOURCES = [
    {
        "name": "OpenAI Blog",
        "url": "https://openai.com/blog/rss.xml",
        "source_type": "official_blog",
    },
    {
        "name": "Hugging Face Blog",
        "url": "https://huggingface.co/blog/feed.xml",
        "source_type": "tech_blog",
    },
    {
        "name": "MIT Tech Review",
        "url": "https://www.technologyreview.com/feed/",
        "source_type": "tech_media",
    },
]

REDDIT_RSS_SOURCES = [
    {"name": "r/MachineLearning", "url": "https://www.reddit.com/r/MachineLearning/.rss"},
    {"name": "r/LocalLLaMA", "url": "https://www.reddit.com/r/LocalLLaMA/.rss"},
]


# ========== 工具函数 ==========

def make_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:12]


def _parse_published(entry) -> datetime | None:
    """从 RSS entry 解析发布时间"""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
    return None


# ========== 异步数据源 ==========

async def fetch_single_rss(client: httpx.AsyncClient, source: dict) -> list[dict]:
    """抓取单个 RSS 源"""
    try:
        resp = await client.get(source["url"], follow_redirects=True)
        feed = feedparser.parse(resp.text)
        items = []
        for entry in feed.entries[:RSS_ITEMS_PER_SOURCE]:
            published = _parse_published(entry)
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
                "source_type": source.get("source_type", "tech_blog"),
                "timestamp": published.isoformat(),
            })
        print(f"  ✅ {source['name']}: {len(items)} items")
        return items
    except Exception as e:
        print(f"  ⚠ {source['name']}: {e}")
        return []


async def fetch_all_rss() -> list[dict]:
    """并发抓取所有 RSS 源"""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        tasks = [fetch_single_rss(client, s) for s in RSS_SOURCES]
        results = await asyncio.gather(*tasks)
    items = [item for r in results for item in r]
    print(f"  📡 RSS 合计: {len(items)} items")
    return items


async def fetch_single_reddit(client: httpx.AsyncClient, sub: dict) -> list[dict]:
    """抓取单个 Reddit 子版 RSS"""
    try:
        resp = await client.get(sub["url"])
        feed = feedparser.parse(resp.text)
        items = []
        for entry in feed.entries[:8]:
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            published = _parse_published(entry)
            if not published:
                published = datetime.now(timezone.utc)
            if published < datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS):
                continue
            items.append({
                "id": make_id(title + sub["name"]),
                "title": title,
                "summary": (entry.get("summary") or "")[:200],
                "url": entry.get("link", ""),
                "source": sub["name"],
                "source_type": "tech_community",
                "timestamp": published.isoformat(),
            })
        print(f"  ✅ {sub['name']}: {len(items)} items")
        return items
    except Exception as e:
        print(f"  ⚠ {sub['name']}: {e}")
        return []


async def fetch_reddit_rss() -> list[dict]:
    """并发抓取 Reddit RSS（无需 OAuth，比 JSON API 更稳定）"""
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": "FlackoTrending/2.0"},
    ) as client:
        tasks = [fetch_single_reddit(client, sub) for sub in REDDIT_RSS_SOURCES]
        results = await asyncio.gather(*tasks)
    items = [item for r in results for item in r]
    print(f"  💬 Reddit RSS 合计: {len(items)} items")
    return items


async def fetch_github_trending() -> list[dict]:
    """GitHub AI 相关 trending 仓库"""
    items = []
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).strftime("%Y-%m-%d")
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                params={
                    "q": f"AI OR LLM OR transformer created:>{since}",
                    "sort": "stars",
                    "order": "desc",
                    "per_page": 20,
                },
                headers={"Accept": "application/vnd.github.v3+json"},
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
        print(f"  ⚠ GitHub: {e}")
    print(f"  🐙 GitHub: {len(items)} items")
    return items


async def fetch_hackernews() -> list[dict]:
    """HackerNews AI 相关热门帖子"""
    items = []
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={
                    "query": "AI OR LLM OR GPT OR transformer OR machine learning",
                    "tags": "story",
                    "hitsPerPage": 15,
                    "numericFilters": "points>10",
                },
            )
        data = resp.json()
        for hit in data.get("hits", []):
            title = (hit.get("title") or "").strip()
            if not title:
                continue
            created = hit.get("created_at", "")
            try:
                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                ts = datetime.now(timezone.utc)
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
        print(f"  ⚠ HackerNews: {e}")
    print(f"  🔶 HackerNews: {len(items)} items")
    return items


async def fetch_all_sources() -> list[dict]:
    """并发爬取所有数据源（4 路同时跑）"""
    results = await asyncio.gather(
        fetch_all_rss(),
        fetch_github_trending(),
        fetch_hackernews(),
        fetch_reddit_rss(),
    )
    return [item for r in results for item in r]


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


def _llm_filter_sync(client: ZhipuAiClient, item: dict, threshold: float) -> dict | None:
    """同步 LLM 筛选（在线程池中运行）"""
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
            thinking={"type": "disabled"},
        )

        raw = response.choices[0].message.content.strip()

        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)

        if not result.get("relevant", False):
            return None
        if result.get("score", 0) < threshold:
            return None

        return {
            "llm_score": result["score"],
            "llm_summary": result.get("one_line_summary", ""),
            "llm_tags": result.get("tags", []),
            "llm_reason": result.get("reason", ""),
        }

    except json.JSONDecodeError:
        print(f"    ⚠ LLM 非JSON: {item['title'][:40]}")
        return None
    except Exception as e:
        print(f"    ⚠ LLM error: {e}")
        return None


async def run_llm_pass_async(
    client: ZhipuAiClient,
    items: list[dict],
    threshold: float,
    label: str = "",
) -> tuple[list[dict], list[dict]]:
    """并发 LLM 筛选（信号量控制并发数）"""
    semaphore = asyncio.Semaphore(LLM_CONCURRENCY)
    prefix = f" ({label})" if label else ""

    async def process(i: int, item: dict):
        async with semaphore:
            result = await asyncio.to_thread(_llm_filter_sync, client, item, threshold)
            return i, item, result

    print(f"  🤖{prefix} 筛选 {len(items)} 条（并发={LLM_CONCURRENCY}，门槛={threshold}）...")
    tasks = [process(i, item) for i, item in enumerate(items)]
    results = await asyncio.gather(*tasks)

    passed, rejected = [], []
    for i, item, result in sorted(results, key=lambda x: x[0]):
        if result:
            item.update(result)
            item["score"] = result["llm_score"]
            passed.append(item)
            print(f"    ✅ [{i+1}] {result['llm_score']} | {result['llm_summary']}")
        else:
            rejected.append(item)
            print(f"    ❌ [{i+1}] {item['title'][:30]}...")

    return passed, rejected


# ========== 数据管理 ==========

def load_existing_data() -> list[dict]:
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def prune_old_items(items: list[dict]) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    kept = []
    for item in items:
        try:
            ts = datetime.fromisoformat(item["timestamp"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts > cutoff:
                kept.append(item)
        except Exception:
            kept.append(item)
    removed = len(items) - len(kept)
    if removed:
        print(f"  🗑 清理 {removed} 条过期内容")
    return kept


def deduplicate(old_items: list[dict], new_items: list[dict]) -> list[dict]:
    existing_ids = {item["id"] for item in old_items}
    return [item for item in new_items if item["id"] not in existing_ids]


# ========== 主流程 ==========

async def main():
    t_start = time.time()

    print("=" * 50)
    print("🚀 AI 热点爬取管道 v2（异步版）")
    print(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   模型: {GLM_MODEL}")
    print(f"   入库: {SAVE_THRESHOLD} | 展示: {SCORE_THRESHOLD} | 保留: {MAX_AGE_DAYS}天")
    print(f"   保底: {MIN_ITEMS_PER_UPDATE} 条 | 并发: {LLM_CONCURRENCY}")
    print(f"   数据源: {len(RSS_SOURCES)} RSS + GitHub + HN + {len(REDDIT_RSS_SOURCES)} Reddit")
    print("=" * 50)

    api_key = _env("ZHIPU_API_KEY")
    if not api_key:
        print("❌ 请设置 ZHIPU_API_KEY")
        sys.exit(1)

    client = ZhipuAiClient(api_key=api_key)

    # 1. 加载已有数据 + 清理过期
    existing = load_existing_data()
    existing = prune_old_items(existing)
    print(f"📂 已有 {len(existing)} 条")

    # 2. 并发爬取所有数据源
    print("\n📡 并发爬取中...")
    t_fetch = time.time()
    raw_items = await fetch_all_sources()
    print(f"   ⏱ 爬取耗时: {time.time() - t_fetch:.1f}s")

    # 3. 去重
    new_items = deduplicate(existing, raw_items)
    print(f"\n🔍 去重后新增 {len(new_items)} 条待筛选")

    if not new_items:
        print("✅ 没有新内容需要筛选")
    else:
        # 4. 第一轮 LLM 筛选（并发）
        t_llm = time.time()
        filtered, rejected = await run_llm_pass_async(
            client, new_items, threshold=SAVE_THRESHOLD, label="首轮",
        )
        print(f"\n🎯 首轮: {len(filtered)}/{len(new_items)} 通过 ({time.time() - t_llm:.1f}s)")

        # 5. 保底机制
        deficit = MIN_ITEMS_PER_UPDATE - len(filtered)
        if deficit > 0 and rejected:
            relaxed = max(SAVE_THRESHOLD - 1.0, 3.0)
            print(f"\n🔬 保底（门槛 {relaxed}，需补 {deficit} 条，候选 {len(rejected)} 条）...")
            extra, still = await run_llm_pass_async(
                client, rejected, threshold=relaxed, label="补充",
            )
            filtered.extend(extra)
            print(f"   补充 {len(extra)} 条，合计 {len(filtered)} 条")

            deficit = MIN_ITEMS_PER_UPDATE - len(filtered)
            if deficit > 0 and still:
                final_t = max(relaxed - 1.0, 2.0)
                print(f"\n🆘 终极兜底（门槛 {final_t}，需补 {deficit} 条）...")
                final_extra, _ = await run_llm_pass_async(
                    client, still, threshold=final_t, label="兜底",
                )
                filtered.extend(final_extra)
                print(f"   终极 {len(final_extra)} 条，最终 {len(filtered)} 条")

        if len(filtered) < MIN_ITEMS_PER_UPDATE:
            print(f"\n⚠️ 仅 {len(filtered)} 条，未达保底 {MIN_ITEMS_PER_UPDATE}")

        existing.extend(filtered)

    # 6. 排序 + 写入
    existing.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\n💾 保存 {len(existing)} 条到 {OUTPUT_FILE}")
    print(f"⏱ 总耗时: {time.time() - t_start:.1f}s")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
