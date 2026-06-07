"""
AI 热点爬取管道 v3
==================

v3 变更：
1. 新增 3 个 Reddit 子版（r/artificial, r/ChatGPT, r/singularity）
2. 新增 ArXiv 学术论文源（cs.AI, cs.CL），含两阶段粗精筛
3. 新增流量监测（trending_stats.json）
4. ArXiv Prompt 采用反向锚点 + 预筛选元数据注入

数据源：
  RSS:  OpenAI Blog, Hugging Face Blog, MIT Tech Review
  API:  GitHub Trending, HackerNews
  RSS:  Reddit ×5（MachineLearning, LocalLLaMA, artificial, ChatGPT, singularity）
  RSS:  ArXiv ×2（cs.AI, cs.CL）
"""

import asyncio
import json
import os
import re
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
STATS_FILE = Path(__file__).parent.parent / "public" / "trending_stats.json"

# --- 通用 ---
MAX_AGE_DAYS = int(_env("MAX_AGE_DAYS", "5"))
FRONTIER_THRESHOLD = int(_env("FRONTIER_THRESHOLD", "80"))
SIGNAL_THRESHOLD = int(_env("SIGNAL_THRESHOLD", "80"))
COMPOSITE_THRESHOLD = int(_env("COMPOSITE_THRESHOLD", "60"))

# --- ArXiv 专用 ---
ARXIV_FRONTIER_THRESHOLD = int(_env("ARXIV_FRONTIER_THRESHOLD", "70"))
ARXIV_UTILITY_THRESHOLD = int(_env("ARXIV_UTILITY_THRESHOLD", "70"))
ARXIV_COMPOSITE_THRESHOLD = int(_env("ARXIV_COMPOSITE_THRESHOLD", "65"))
ARXIV_MAX_ITEMS_PER_SOURCE = int(_env("ARXIV_MAX_ITEMS_PER_SOURCE", "100"))

# --- LLM ---
GLM_MODEL = _env("ZHIPU_MODEL", "glm-4.7-flash")
GLM_TEMPERATURE = float(_env("ZHIPU_TEMPERATURE", "0.1"))
GLM_MAX_TOKENS = int(_env("ZHIPU_MAX_TOKENS", "512"))
LLM_CONCURRENCY = 5

# --- 爬取 ---
RSS_ITEMS_PER_SOURCE = int(_env("RSS_ITEMS_PER_SOURCE", "8"))
HTTP_TIMEOUT = int(_env("HTTP_TIMEOUT", "15"))
MIN_ITEMS_PER_UPDATE = int(_env("MIN_ITEMS_PER_UPDATE", "8"))


# ========== OR 门评分逻辑 ==========

def should_accept(frontier: int, signal: int) -> bool:
    """通用 OR 门（热点资讯用）"""
    if frontier < 25 and signal < 25:
        return False
    if frontier >= FRONTIER_THRESHOLD or signal >= SIGNAL_THRESHOLD:
        return True
    return frontier * 0.6 + signal * 0.4 >= COMPOSITE_THRESHOLD


def should_accept_arxiv(frontier: int, utility: int, has_code: bool = False) -> bool:
    """ArXiv OR 门（学术论文用）
    通过条件（任一满足即可）：
    - 前沿性 >= 70
    - 实用性 >= 70
    - 加权综合 >= 65
    - 有开源代码 + 综合 >= 55
    """
    if frontier < 20 and utility < 20:
        return False
    if frontier >= ARXIV_FRONTIER_THRESHOLD:
        return True
    if utility >= ARXIV_UTILITY_THRESHOLD:
        return True
    composite = frontier * 0.5 + utility * 0.5
    if composite >= ARXIV_COMPOSITE_THRESHOLD:
        return True
    if has_code and composite >= 55:
        return True
    return False


# ========== 数据源定义 ==========

RSS_SOURCES = [
    {"name": "OpenAI Blog", "url": "https://openai.com/blog/rss.xml", "source_type": "official_blog"},
    {"name": "Hugging Face Blog", "url": "https://huggingface.co/blog/feed.xml", "source_type": "tech_blog"},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "source_type": "tech_media"},
]

REDDIT_RSS_SOURCES = [
    {"name": "r/MachineLearning", "url": "https://www.reddit.com/r/MachineLearning/.rss"},
    {"name": "r/LocalLLaMA", "url": "https://www.reddit.com/r/LocalLLaMA/.rss"},
    {"name": "r/artificial", "url": "https://www.reddit.com/r/artificial/.rss"},
    {"name": "r/ChatGPT", "url": "https://www.reddit.com/r/ChatGPT/.rss"},
    {"name": "r/singularity", "url": "https://www.reddit.com/r/singularity/.rss"},
]

ARXIV_SOURCES = [
    {"name": "ArXiv cs.AI", "url": "http://export.arxiv.org/rss/cs.AI", "category": "cs.AI"},
    {"name": "ArXiv cs.CL", "url": "http://export.arxiv.org/rss/cs.CL", "category": "cs.CL"},
]


# ========== 粗筛白名单/黑名单 ==========

# 顶级实验室/机构关键词（代码层匹配，不让 LLM 猜）
TOP_LABS = [
    "openai", "deepmind", "google research", "google deepmind", "google brain",
    "meta ai", "meta fair", "facebook ai", "microsoft research", "microsoft research asia",
    "deepseek", "anthropic", "nvidia research", "tsinghua", "peking university",
    "stanford", "mit csail", "uc berkeley", "berkeley ai research", "princeton",
    "cmu", "eth zurich", "max planck", "allen institute", "ai2",
    "zipline", "bytedance", "alibaba", "tencent ai", "baidu research",
]

# ArXiv 粗筛：AI 相关关键词（命任一即保留）
AI_KEYWORDS = [
    "transformer", "llm", "language model", "large language", "diffusion model",
    "generative", "embedding", "rag", "retrieval-augmented", "agent", "rlhf",
    "fine-tun", "lora", "qlora", "quantiz", "inference", "multimodal",
    "vision-language", "text-to-image", "image generation", "video generation",
    "speech", "tokenizer", "attention mechanism", "mixture of experts", "moe",
    "chain-of-thought", "prompt", "alignment", "safety", "reasoning",
    "code generation", "reinforcement learning from human", "dpo", "ppo",
    "knowledge distill", "pruning", "speculative decoding", "kv cache",
    "long context", "context window", "function calling", "tool use",
]

# ArXiv 粗筛：排除关键词（命任一即丢弃，除非同时命中白名单）
BLOCKED_KEYWORDS = [
    "medical imaging", "clinical", "disease diagnosis", "cancer detection",
    "climate model", "weather prediction", "physics simulation",
    "robotics hardware", "sensor fusion", "iot", "wireless sensor",
    "pure mathematics", "number theory", "algebraic geometry",
    "power grid", "traffic flow", "supply chain optimization",
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


# ========== ArXiv 预筛选 ==========

def detect_lab_match(authors: str, abstract: str) -> bool:
    """代码层匹配顶级实验室（不让 LLM 瞎猜）"""
    text = (authors + " " + abstract).lower()
    return any(lab in text for lab in TOP_LABS)


def detect_code_link(abstract: str) -> bool:
    """检测摘要中是否提到开源代码"""
    lower = abstract.lower()
    return bool(
        "github.com" in lower
        or "code is available" in lower
        or "open-source" in lower
        or "code at" in lower
        or "anonymized github" in lower
        or re.search(r"code[:\s].*https?://", lower)
    )


def coarse_filter_arxiv(title: str, abstract: str) -> bool:
    """粗筛：零成本关键词过滤，刷掉 ~70% 无关论文"""
    text = (title + " " + abstract).lower()

    # 白名单命中数
    ai_hits = sum(1 for kw in AI_KEYWORDS if kw in text)

    # 黑名单命中数
    blocked_hits = sum(1 for kw in BLOCKED_KEYWORDS if kw in text)

    # 至少命中 1 个 AI 关键词，且黑名单命中少于白名单
    return ai_hits >= 1 and blocked_hits < ai_hits


def pre_score_paper(title: str, abstract: str, authors: str) -> dict:
    """代码层预筛选，结果注入 LLM Prompt"""
    return {
        "lab_match": detect_lab_match(authors, abstract),
        "has_code": detect_code_link(abstract),
    }


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
    """并发抓取 Reddit RSS"""
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": "FlackoTrending/3.0"},
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


async def fetch_arxiv() -> list[dict]:
    """抓取 ArXiv RSS（cs.AI + cs.CL），带粗筛"""
    all_items = []
    async with httpx.AsyncClient(timeout=30) as client:
        for source in ARXIV_SOURCES:
            try:
                resp = await client.get(source["url"])
                feed = feedparser.parse(resp.text)
                raw_count = len(feed.entries)
                filtered_count = 0

                for entry in feed.entries[:ARXIV_MAX_ITEMS_PER_SOURCE]:
                    title = (entry.get("title") or "").strip().replace("\n", " ")
                    summary = (entry.get("summary") or "").strip().replace("\n", " ")
                    authors = entry.get("author", "") or ""
                    # feedparser 可能把 dc:creator 放在其他位置
                    if not authors:
                        tags = entry.get("tags", [])
                        authors = ", ".join(t.get("term", "") for t in tags if t.get("term"))

                    if not title:
                        continue

                    # 粗筛：关键词过滤
                    if not coarse_filter_arxiv(title, summary):
                        continue
                    filtered_count += 1

                    published = _parse_published(entry)
                    if not published:
                        published = datetime.now(timezone.utc)
                    if published < datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS):
                        continue

                    # 预筛选：实验室匹配 + 开源代码检测
                    pre = pre_score_paper(title, summary, authors)

                    all_items.append({
                        "id": make_id(title + source["category"]),
                        "title": title,
                        "summary": summary[:800],
                        "url": entry.get("link", ""),
                        "source": source["name"],
                        "source_type": "academic_paper",
                        "timestamp": published.isoformat(),
                        "_authors": authors[:300],
                        "_pre_score": pre,
                    })

                print(f"  ✅ {source['name']}: {filtered_count}/{raw_count} passed coarse filter")

            except Exception as e:
                print(f"  ⚠ {source['name']}: {e}")

    print(f"  📄 ArXiv 粗筛后合计: {len(all_items)} items")
    return all_items


async def fetch_all_sources() -> tuple[list[dict], list[dict]]:
    """并发爬取所有数据源，返回 (常规内容, ArXiv 内容)"""
    results = await asyncio.gather(
        fetch_all_rss(),
        fetch_github_trending(),
        fetch_hackernews(),
        fetch_reddit_rss(),
        fetch_arxiv(),
    )
    regular = [item for r in results[:4] for item in r]
    arxiv = results[4]
    return regular, arxiv


# ========== LLM 筛选引擎 ==========

# --- 常规内容 Prompt（热点资讯） ---
SYSTEM_PROMPT = """你是 AI 领域的内容筛选专家，为关注 AI 技术的计算机从业者筛选值得阅读的内容。

━━━ 评估维度 ━━━

对每条内容从两个维度分别打分（0-100 整数）：

1. 前沿性 — 内容涉及的技术/产品/发现有多前沿？
   90-100: 行业里程碑（新架构、重大突破、首个某类产品）
   70-89:  重要进展（新模型、重要论文、重大版本更新）
   50-69:  常规动态（版本迭代、功能改进、应用案例）
   30-49:  旧闻重发或浅层解读
   0-29:   无新技术内容

2. 信息含量 — 内容包含多少实质信息？
   90-100: 信息密集（含代码、数据、完整方案、深入分析）
   70-89:  有 2-3 个明确信息点（有数据、有具体描述）
   50-69:  有 1 个有价值的信息点（基本事实清楚但缺细节）
   30-49:  主要为转述（缺乏增量信息）
   0-29:   空洞营销/标题党（无实质内容）

━━━ 评分示例 ━━━

示例1:
标题: "OpenAI announces GPT-5 with native multimodal reasoning"
来源: OpenAI Blog
→ frontier: 95, signal: 65
（新模型 = 行业里程碑；PR 稿有核心规格但缺技术细节）

示例2:
标题: "A practical guide to fine-tuning LLMs with LoRA and QLoRA"
来源: Hugging Face Blog
→ frontier: 40, signal: 92
（LoRA 已成熟不算前沿；但教程含完整代码，信息含量极高）

示例3:
标题: "AI will replace 80% of jobs by 2030, says tech CEO"
来源: MIT Tech Review
→ frontier: 10, signal: 15
（纯观点炒作，无新技术无实质信息）

━━━ 输出格式 ━━━

只返回 JSON，不要其他文字：
{
  "frontier": 整数,
  "signal": 整数,
  "summary": "一句话中文摘要，15-35字",
  "tags": ["标签1", "标签2"]
}

tags 规则：2-4 个 | 中文 | 每个标签 2-6 字 | 只描述技术领域（不写"教程""新闻"）"""


# --- ArXiv 学术论文 Prompt ---
ARXIV_SYSTEM_PROMPT = """你是 AI 领域的学术论文筛选专家，为关注 AI 技术的计算机从业者筛选值得关注的论文。

━━━ 预筛选信息 ━━━
（代码层已对论文做了初步分析，请结合以下信息调整评分）
- 顶级实验室/机构匹配: {lab_match}
- 摘要提及开源代码: {has_code}

━━━ 评估维度 ━━━

对每篇论文从两个维度分别打分（0-100 整数）：
请严格保持两个维度的独立评估，不可互相妥协凑分。

1. 前沿性 — 论文提出的方法/发现有多新？
   90-100: 开创性工作（新架构、新范式、突破性成果）
   70-89:  重要改进（已有方法显著提升、新应用场景）
   50-69:  渐进式改进（现有方法小幅优化）
   0-49:   增量工作或重复已有思路

2. 实用性 — 对 AI 从业者的实际工程价值？
   90-100: 可直接落地（开源代码 + 完整方案 + benchmark 对比）
   70-89:  有参考价值（思路可迁移、有实验数据支撑）
   50-69:  有启发但需较多转化工作
   0-49:   纯理论，短期难以应用

━━━ 反向锚点（硬性上限，必须严格执行） ━━━

以下情况必须低分，不可因为其他维度表现好而放宽：
- 仅在闭源/私有数据集上微弱提升且未开源 → 前沿性 ≤ 60
- 缺乏具体实现细节、未提及 benchmark 或性能数据 → 实用性 ≤ 50
- 纯数学证明/理论分析且无实验验证 → 实用性 ≤ 40
- 增量式改进（如换了损失函数提了 0.1%）→ 前沿性 ≤ 45
- 只在摘要中出现"state-of-the-art"但无具体数据佐证 → 两个维度各 -15

━━━ 预筛选信息的影响规则 ━━━

- 实验室匹配为"是" → 前沿性至少 60（顶级机构不太会发垃圾论文）
- 开源代码为"是" → 实用性至少 70（有代码可直接复现）
- 两者均为"否" → 不额外调整，按实际内容评分

━━━ 评分示例 ━━━

示例1:
标题: "FlashAttention-3: Hardware-Aware Attention for H100 GPUs"
摘要: ...提出针对 H100 优化的注意力机制，推理速度提升 2x...
实验室匹配: 是（Meta AI）
开源代码: 是
→ frontier: 80, signal: 90
（注意力架构改进=重要进展+顶级实验室；有代码+2x加速=极高实用价值）

示例2:
标题: "A Theoretical Framework for Convergence of SGD in Non-Convex Settings"
摘要: ...纯数学收敛性证明...
实验室匹配: 否
开源代码: 否
→ frontier: 25, signal: 20
（纯理论=低实用；非新架构=低前沿）

示例3:
标题: "Benchmarking LLM Inference Engines: vLLM vs TensorRT-LLM vs llama.cpp"
摘要: ...全面对比测试，含延迟/吞吐量数据...
实验室匹配: 否
开源代码: 是
→ frontier: 40, signal: 92
（对比测试不算前沿=低前沿；但完整数据+开源=极高实用价值）

━━━ 输出格式 ━━━

只返回 JSON，不要其他文字：
{
  "frontier": 整数,
  "signal": 整数,
  "summary": "一句话中文摘要，15-35字",
  "tags": ["标签1", "标签2"]
}

tags 规则：2-4 个 | 中文 | 每个标签 2-6 字 | 只描述技术领域（不写"论文""研究"）
如果有开源代码，tags 中必须包含"🔧 已开源""""


def _llm_filter_sync(
    client: ZhipuAiClient,
    item: dict,
    system_prompt: str,
    user_msg: str,
) -> dict | None:
    """同步 LLM 筛选（在线程池中运行）"""
    try:
        response = client.chat.completions.create(
            model=GLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
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

        frontier = int(result.get("frontier", 0))
        signal = int(result.get("signal", 0))

        return {
            "frontier": frontier,
            "signal": signal,
            "llm_summary": result.get("summary", ""),
            "llm_tags": result.get("tags", []),
        }

    except json.JSONDecodeError:
        print(f"    ⚠ LLM 非JSON: {item['title'][:40]}")
        return None
    except Exception as e:
        print(f"    ⚠ LLM error: {e}")
        return None


def _build_user_msg_regular(item: dict) -> str:
    """构建常规内容的 user message"""
    return f"""标题：{item['title']}
来源：{item['source']}
类型：{item.get('source_type', 'unknown')}
摘要：{item.get('summary', '无摘要')[:300]}"""


def _build_user_msg_arxiv(item: dict) -> str:
    """构建 ArXiv 论文的 user message（注入预筛选元数据）"""
    pre = item.get("_pre_score", {})
    lab_str = "是" if pre.get("lab_match") else "否"
    code_str = "是" if pre.get("has_code") else "否"

    # 把预筛选信息注入 system prompt
    prompt = ARXIV_SYSTEM_PROMPT.format(lab_match=lab_str, has_code=code_str)

    user = f"""标题：{item['title']}
作者：{item.get('_authors', '未知')[:200]}
摘要：{item.get('summary', '无摘要')[:500]}"""

    return prompt, user


async def run_llm_pass_async(
    client: ZhipuAiClient,
    items: list[dict],
    mode: str = "regular",
) -> tuple[list[dict], list[dict]]:
    """并发 LLM 筛选
    mode: "regular" 使用通用 Prompt, "arxiv" 使用论文 Prompt
    """
    semaphore = asyncio.Semaphore(LLM_CONCURRENCY)

    async def process(i: int, item: dict):
        async with semaphore:
            if mode == "arxiv":
                arxiv_prompt, user_msg = _build_user_msg_arxiv(item)
                result = await asyncio.to_thread(
                    _llm_filter_sync, client, item, arxiv_prompt, user_msg
                )
                if result:
                    has_code = item.get("_pre_score", {}).get("has_code", False)
                    if not should_accept_arxiv(result["frontier"], result["signal"], has_code):
                        result = None
            else:
                user_msg = _build_user_msg_regular(item)
                result = await asyncio.to_thread(
                    _llm_filter_sync, client, item, SYSTEM_PROMPT, user_msg
                )
                if result:
                    if not should_accept(result["frontier"], result["signal"]):
                        result = None
            return i, item, result

    print(f"  🤖 筛选 {len(items)} 条 [{mode}]（并发={LLM_CONCURRENCY}）...")
    tasks = [process(i, item) for i, item in enumerate(items)]
    results = await asyncio.gather(*tasks)

    passed, rejected = [], []
    for i, item, result in sorted(results, key=lambda x: x[0]):
        if result:
            # 计算综合分
            if mode == "arxiv":
                composite = round(result["frontier"] * 0.5 + result["signal"] * 0.5)
                has_code = item.get("_pre_score", {}).get("has_code", False)
                if has_code and "🔧 已开源" not in result.get("llm_tags", []):
                    result["llm_tags"].insert(0, "🔧 已开源")
            else:
                composite = round(result["frontier"] * 0.6 + result["signal"] * 0.4)

            item.update({
                "frontier": result["frontier"],
                "signal": result["signal"],
                "score": composite,
                "llm_summary": result.get("llm_summary", ""),
                "llm_tags": result.get("llm_tags", []),
            })
            # 清理内部字段
            item.pop("_authors", None)
            item.pop("_pre_score", None)
            passed.append(item)
            print(f"    ✅ [{i+1}] F{result['frontier']} S{result['signal']} → {composite} | {result.get('llm_summary', '')}")
        else:
            item.pop("_authors", None)
            item.pop("_pre_score", None)
            rejected.append(item)
            print(f"    ❌ [{i+1}] {item['title'][:40]}...")

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


def prune_old_items(items: list[dict]) -> tuple[list[dict], int]:
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
    return kept, removed


def deduplicate(old_items: list[dict], new_items: list[dict]) -> tuple[list[dict], int]:
    existing_ids = {item["id"] for item in old_items}
    new = [item for item in new_items if item["id"] not in existing_ids]
    dupes = len(new_items) - len(new)
    return new, dupes


# ========== 流量监测 ==========

def save_stats(stats: dict):
    """追加写入运行统计（保留最近 200 条）"""
    history = []
    if STATS_FILE.exists():
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass

    history.append(stats)
    history = history[-200:]  # 只保留最近 200 次

    STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


# ========== 主流程 ==========

async def main():
    t_start = time.time()
    stats = {
        "run_time": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": 0,
        "crawl": {"total_fetched": 0, "per_source": {}, "failed_sources": []},
        "dedup": {"new_items": 0, "duplicate_items": 0},
        "arxiv_coarse": {"total": 0, "passed": 0},
        "llm_filter": {
            "regular": {"total": 0, "passed": 0, "rejected": 0},
            "arxiv": {"total": 0, "passed": 0, "rejected": 0},
        },
        "storage": {"total_items": 0, "pruned_old": 0},
    }

    print("=" * 50)
    print("🚀 AI 热点爬取管道 v3")
    print(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   模型: {GLM_MODEL}")
    print(f"   常规 OR门: 前沿≥{FRONTIER_THRESHOLD} | 信息≥{SIGNAL_THRESHOLD} | 综合≥{COMPOSITE_THRESHOLD}")
    print(f"   ArXiv OR门: 前沿≥{ARXIV_FRONTIER_THRESHOLD} | 实用≥{ARXIV_UTILITY_THRESHOLD} | 综合≥{ARXIV_COMPOSITE_THRESHOLD}")
    print(f"   保留: {MAX_AGE_DAYS}天 | 监控线: {MIN_ITEMS_PER_UPDATE}条 | 并发: {LLM_CONCURRENCY}")
    print(f"   数据源: {len(RSS_SOURCES)} RSS + GitHub + HN + {len(REDDIT_RSS_SOURCES)} Reddit + {len(ARXIV_SOURCES)} ArXiv")
    print("=" * 50)

    api_key = _env("ZHIPU_API_KEY")
    if not api_key:
        print("❌ 请设置 ZHIPU_API_KEY")
        sys.exit(1)

    client = ZhipuAiClient(api_key=api_key)

    # 1. 加载已有数据 + 清理过期
    existing = load_existing_data()
    existing, pruned = prune_old_items(existing)
    stats["storage"]["pruned_old"] = pruned
    print(f"📂 已有 {len(existing)} 条")

    # 2. 并发爬取所有数据源
    print("\n📡 并发爬取中...")
    t_fetch = time.time()
    regular_items, arxiv_items = await fetch_all_sources()
    print(f"   ⏱ 爬取耗时: {time.time() - t_fetch:.1f}s")

    # 记录各源爬取量
    all_raw = regular_items + arxiv_items
    stats["crawl"]["total_fetched"] = len(all_raw)
    from collections import Counter
    source_counts = Counter(item.get("source", "?") for item in all_raw)
    stats["crawl"]["per_source"] = dict(source_counts)

    # 3. 去重
    regular_new, reg_dupes = deduplicate(existing, regular_items)
    arxiv_new, arxiv_dupes = deduplicate(existing, arxiv_items)
    stats["dedup"]["new_items"] = len(regular_new) + len(arxiv_new)
    stats["dedup"]["duplicate_items"] = reg_dupes + arxiv_dupes

    # ArXiv 粗筛统计（粗筛已在 fetch_arxiv 中完成）
    stats["arxiv_coarse"]["total"] = len(arxiv_items) + arxiv_dupes  # 粗筛前大约量
    stats["arxiv_coarse"]["passed"] = len(arxiv_new) + arxiv_dupes

    print(f"\n🔍 去重后新增: 常规 {len(regular_new)} 条 + ArXiv {len(arxiv_new)} 条")
    print(f"   重复丢弃: {reg_dupes + arxiv_dupes} 条")

    all_filtered = []

    # 4a. LLM 筛选：常规内容
    if regular_new:
        t_llm = time.time()
        passed, rejected = await run_llm_pass_async(client, regular_new, mode="regular")
        print(f"\n🎯 常规通过: {len(passed)}/{len(regular_new)} ({time.time() - t_llm:.1f}s)")
        all_filtered.extend(passed)
        stats["llm_filter"]["regular"] = {
            "total": len(regular_new),
            "passed": len(passed),
            "rejected": len(rejected),
        }
    else:
        print("\n✅ 常规内容无新增")

    # 4b. LLM 筛选：ArXiv 论文
    if arxiv_new:
        t_llm = time.time()
        passed, rejected = await run_llm_pass_async(client, arxiv_new, mode="arxiv")
        print(f"\n🎯 ArXiv 通过: {len(passed)}/{len(arxiv_new)} ({time.time() - t_llm:.1f}s)")
        all_filtered.extend(passed)
        stats["llm_filter"]["arxiv"] = {
            "total": len(arxiv_new),
            "passed": len(passed),
            "rejected": len(rejected),
        }
    else:
        print("\n✅ ArXiv 内容无新增")

    # 5. 软监控
    total_passed = len(all_filtered)
    if total_passed < MIN_ITEMS_PER_UPDATE:
        print(f"\n⚠️ 本轮仅 {total_passed} 条，低于监控线 {MIN_ITEMS_PER_UPDATE}（不强制补充）")

    existing.extend(all_filtered)

    # 6. 排序 + 写入
    existing.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    stats["storage"]["total_items"] = len(existing)
    stats["duration_seconds"] = round(time.time() - t_start, 1)

    # 7. 保存运行统计
    save_stats(stats)

    print(f"\n💾 保存 {len(existing)} 条到 {OUTPUT_FILE}")
    print(f"📊 统计写入 {STATS_FILE}")
    print(f"⏱ 总耗时: {stats['duration_seconds']}s")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
