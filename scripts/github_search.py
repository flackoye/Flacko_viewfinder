"""
GitHub API 搜索模块
==================
按分类搜索高星 AI 开源项目，拉取 README 内容。

用法:
  from github_search import search_all_categories, fetch_readme
  repos = asyncio.run(search_all_categories())
"""

import asyncio
import os
import sys
import base64
from pathlib import Path
from typing import Optional

# Windows 终端 GBK 编码无法输出 emoji
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import httpx


# ========== 配置 ==========

def load_env():
    """加载 .env"""
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_env()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip('"').strip("'")
HTTP_TIMEOUT = int(os.environ.get("HTTP_TIMEOUT", "15"))


# ========== 分类定义 ==========

CATEGORIES = {
    "LLM": {
        "queries": ["topic:llm stars:>5000", "topic:large-language-model stars:>5000"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "Agent": {
        "queries": ["topic:ai-agent stars:>2000", "topic:llm-agent stars:>2000", "topic:autonomous-agent stars:>1000"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "RAG": {
        "queries": ["topic:rag stars:>1000", "topic:retrieval-augmented-generation stars:>500"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "Vector DB": {
        "queries": ["topic:vector-database stars:>1000", "topic:vector-search stars:>1000", "topic:embedding-database stars:>500"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "Prompt Engineering": {
        "queries": ["topic:prompt-engineering stars:>1000", "prompt in:name,description stars:>500 topic:llm"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "Diffusion": {
        "queries": ["topic:stable-diffusion stars:>5000", "topic:diffusion-model stars:>3000"],
        "sort": "stars",
        "max_per_query": 15,
    },
    "Data & Training": {
        "queries": ["topic:dataset stars:>3000 topic:machine-learning", "topic:ml-training stars:>1000"],
        "sort": "stars",
        "max_per_query": 15,
    },
}


# ========== GitHub API ==========

def _headers() -> dict:
    """构建请求头"""
    h = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "FlackoRAG/1.0",
    }
    if GITHUB_TOKEN:
        h["Authorization"] = f"token {GITHUB_TOKEN}"
    return h


async def search_repos(
    client: httpx.AsyncClient,
    query: str,
    sort: str = "stars",
    max_repos: int = 15,
) -> list[dict]:
    """搜索 GitHub 仓库，返回基本信息列表"""
    results = []
    page = 1
    per_page = min(max_repos, 100)

    while len(results) < max_repos:
        try:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                params={
                    "q": query,
                    "sort": sort,
                    "order": "desc",
                    "per_page": per_page,
                    "page": page,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                results.append({
                    "full_name": item["full_name"],
                    "name": item["name"],
                    "description": item.get("description") or "",
                    "html_url": item["html_url"],
                    "stars": item["stargazers_count"],
                    "language": item.get("language"),
                    "topics": item.get("topics", []),
                    "updated_at": item.get("updated_at", ""),
                    "readme": "",  # 后续填充
                })

            # 检查是否还有下一页
            if len(items) < per_page:
                break
            page += 1

            # 检查速率限制
            remaining = int(resp.headers.get("X-RateLimit-Remaining", "9999"))
            if remaining < 5:
                reset_time = int(resp.headers.get("X-RateLimit-Reset", "0"))
                import time
                wait = max(reset_time - int(time.time()), 1) + 1
                print(f"  ⏳ GitHub API 接近速率限制，等待 {wait}s...")
                await asyncio.sleep(wait)

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                print(f"  ⚠️ GitHub API 速率限制，停止搜索")
                break
            print(f"  ⚠️ GitHub 搜索失败: {e}")
            break
        except Exception as e:
            print(f"  ⚠️ GitHub 搜索异常: {e}")
            break

    return results[:max_repos]


async def fetch_readme(
    client: httpx.AsyncClient,
    full_name: str,
) -> Optional[str]:
    """拉取仓库 README 内容（原始文本）"""
    try:
        resp = await client.get(
            f"https://api.github.com/repos/{full_name}/readme",
            headers={"Accept": "application/vnd.github.raw+json"},
        )
        if resp.status_code == 200:
            text = resp.text
            if len(text) >= 200:  # 过滤掉极短的 README
                return text
        return None
    except Exception as e:
        print(f"  ⚠️ README 拉取失败 ({full_name}): {e}")
        return None


def _dedupe(repos: list[dict]) -> list[dict]:
    """按 full_name 去重，保留 star 最多的"""
    seen: dict[str, dict] = {}
    for repo in repos:
        name = repo["full_name"]
        if name not in seen or repo["stars"] > seen[name]["stars"]:
            seen[name] = repo
    return list(seen.values())


async def search_category(
    client: httpx.AsyncClient,
    category: str,
    config: dict,
    semaphore: asyncio.Semaphore,
) -> list[dict]:
    """搜索一个分类下的所有项目"""
    all_repos = []
    for query in config["queries"]:
        async with semaphore:
            repos = await search_repos(
                client,
                query,
                sort=config["sort"],
                max_repos=config["max_per_query"],
            )
            all_repos.extend(repos)

    # 去重
    repos = _dedupe(all_repos)

    # 并发拉 README
    print(f"  📂 {category}: 找到 {len(repos)} 个仓库，正在拉取 README...")

    async def _fetch_one(repo: dict) -> dict:
        async with semaphore:
            readme = await fetch_readme(client, repo["full_name"])
            repo["readme"] = readme or ""
            repo["category"] = category
            return repo

    repos_with_readme = await asyncio.gather(*[_fetch_one(r) for r in repos])

    # 过滤掉没有 README 的
    valid = [r for r in repos_with_readme if r["readme"]]
    skipped = len(repos_with_readme) - len(valid)
    if skipped:
        print(f"    ⏭️ 跳过 {skipped} 个无 README 的仓库")
    print(f"    ✅ {category}: {len(valid)} 个有效项目")
    return valid


async def search_all_categories() -> list[dict]:
    """搜索所有分类，返回去重后的项目列表"""
    semaphore = asyncio.Semaphore(5)  # 并发限制
    all_repos = []

    async with httpx.AsyncClient(
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
        follow_redirects=True,
    ) as client:
        if GITHUB_TOKEN:
            print("🔑 使用 GitHub Token（5000 req/hr）")
        else:
            print("⚠️ 无 GitHub Token，速率限制 60 req/hr，可能无法拉取全部项目")

        tasks = []
        for category, config in CATEGORIES.items():
            tasks.append(search_category(client, category, config, semaphore))

        results = await asyncio.gather(*tasks)
        for repos in results:
            all_repos.extend(repos)

    # 最终去重（跨分类）
    all_repos = _dedupe(all_repos)

    # 按 star 降序
    all_repos.sort(key=lambda r: r["stars"], reverse=True)

    print(f"\n🎉 共获取 {len(all_repos)} 个高星 AI 项目")
    return all_repos


if __name__ == "__main__":
    repos = asyncio.run(search_all_categories())
    for r in repos[:5]:
        print(f"  {r['full_name']:40s} ⭐{r['stars']:>8,}  [{r['category']}]  README: {len(r['readme']):>6,} chars")
