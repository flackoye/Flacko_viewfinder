"""
RAG 索引构建脚本
================
从 GitHub 拉取高星 AI 项目 → 切块 → Embedding → 导出 JSON

输出:
  public/projects.json          — 项目元数据（静态展示 + 卡片）
  public/project_embeddings.json — 向量索引（RAG 检索用）

用法:
  python scripts/build_rag_index.py
"""

import asyncio
import json
import os
import sys
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone

# Windows 终端 GBK 编码无法输出 emoji，通过环境变量解决
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from zai import ZhipuAiClient
from github_search import search_all_categories


# ========== 配置 ==========

def load_env():
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_env()

API_KEY = os.environ.get("ZHIPU_API_KEY", "").strip('"').strip("'")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "embedding-3")
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "512"))

PUBLIC_DIR = Path(__file__).parent.parent / "public"
PROJECTS_FILE = PUBLIC_DIR / "projects.json"
EMBEDDINGS_FILE = PUBLIC_DIR / "project_embeddings.json"

# 切块参数
CHUNK_SIZE = 1500      # 字符数（约 512 token）
CHUNK_OVERLAP = 200    # 重叠字符数
MIN_CHUNK_SIZE = 100   # 过短的块合并

# Embedding 批量参数
EMBED_BATCH_SIZE = 8   # 每批条数
EMBED_BATCH_DELAY = 1.0  # 批间延迟（秒）
EMBED_RETRY_MAX = 3
EMBED_RETRY_BASE = 3.0


# ========== 切块逻辑 ==========

def chunk_by_headings(text: str) -> list[tuple[str, str]]:
    """按 Markdown 标题切分，返回 [(标题, 内容)] 列表"""
    import re
    sections = []
    current_heading = "Introduction"
    current_lines = []

    for line in text.splitlines():
        heading_match = re.match(r'^(#{1,4})\s+(.+)', line)
        if heading_match:
            # 保存当前段落
            if current_lines:
                sections.append((current_heading, "\n".join(current_lines)))
            current_heading = heading_match.group(2).strip()
            current_lines = []
        else:
            current_lines.append(line)

    # 最后一段
    if current_lines:
        sections.append((current_heading, "\n".join(current_lines)))

    return sections


def split_long_section(text: str, max_chars: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """将过长的段落按字符切分，带重叠"""
    if len(text) <= max_chars:
        return [text] if len(text) >= MIN_CHUNK_SIZE else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars

        # 尝试在段落边界切
        if end < len(text):
            # 找最近的空行
            boundary = text.rfind("\n\n", start + max_chars // 2, end)
            if boundary > start:
                end = boundary + 2
            else:
                # 找最近的换行
                boundary = text.rfind("\n", start + max_chars // 2, end)
                if boundary > start:
                    end = boundary + 1

        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_SIZE:
            chunks.append(chunk)

        start = end - overlap if end < len(text) else end
        if start <= end - max_chars:  # 防止死循环
            start = end

    return chunks


def chunk_readme(text: str, repo_full_name: str, category: str) -> list[dict]:
    """将 README 切分为带元数据的块"""
    sections = chunk_by_headings(text)
    chunks = []

    for section_title, section_text in sections:
        section_text = section_text.strip()
        if not section_text or len(section_text) < MIN_CHUNK_SIZE:
            continue

        sub_chunks = split_long_section(section_text)
        for i, chunk_text in enumerate(sub_chunks):
            chunk_id = hashlib.md5(
                f"{repo_full_name}:{section_title}:{i}:{chunk_text[:100]}".encode()
            ).hexdigest()[:12]

            chunks.append({
                "id": chunk_id,
                "repo_full_name": repo_full_name,
                "category": category,
                "section_title": section_title,
                "chunk_index": i,
                "text": chunk_text,
            })

    return chunks


# ========== Embedding ==========

def _embed_batch_sync(client: ZhipuAiClient, texts: list[str]) -> list[list[float]]:
    """同步批量 embedding，带重试"""
    for attempt in range(EMBED_RETRY_MAX):
        try:
            response = client.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL,
                dimensions=EMBEDDING_DIMENSIONS,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "速率限制" in err_str or "rate" in err_str.lower():
                wait = EMBED_RETRY_BASE * (attempt + 1)
                print(f"    ⚠️ Embedding 429 限速，{wait:.0f}s 后重试 ({attempt+1}/{EMBED_RETRY_MAX})...")
                time.sleep(wait)
                continue
            print(f"    ❌ Embedding 失败: {e}")
            raise
    raise RuntimeError(f"Embedding 重试 {EMBED_RETRY_MAX} 次后仍失败")


async def embed_all_chunks(chunks: list[dict]) -> list[dict]:
    """对所有块进行 embedding"""
    client = ZhipuAiClient(api_key=API_KEY)
    total = len(chunks)
    embedded_chunks = []
    failed = 0

    print(f"\n📊 开始 Embedding: {total} 个块, 模型={EMBEDDING_MODEL}, 维度={EMBEDDING_DIMENSIONS}")

    for batch_start in range(0, total, EMBED_BATCH_SIZE):
        batch = chunks[batch_start:batch_start + EMBED_BATCH_SIZE]
        texts = [c["text"] for c in batch]

        try:
            embeddings = await asyncio.to_thread(
                _embed_batch_sync, client, texts
            )

            for chunk, embedding in zip(batch, embeddings):
                chunk["embedding"] = embedding
                embedded_chunks.append(chunk)

        except Exception as e:
            failed += len(batch)
            print(f"    ❌ 批次 {batch_start//EMBED_BATCH_SIZE + 1} 失败: {e}")

        # 批间延迟
        if batch_start + EMBED_BATCH_SIZE < total:
            await asyncio.sleep(EMBED_BATCH_DELAY)

        # 进度
        done = min(batch_start + EMBED_BATCH_SIZE, total)
        if done % (EMBED_BATCH_SIZE * 10) == 0 or done == total:
            print(f"    进度: {done}/{total} ({done*100//total}%)")

    print(f"\n✅ Embedding 完成: {len(embedded_chunks)} 成功, {failed} 失败")
    return embedded_chunks


# ========== 导出 ==========

def export_projects_json(repos: list[dict]) -> None:
    """导出项目元数据"""
    projects = []
    for repo in repos:
        projects.append({
            "id": hashlib.md5(repo["full_name"].encode()).hexdigest()[:12],
            "full_name": repo["full_name"],
            "name": repo["name"],
            "description": repo["description"],
            "html_url": repo["html_url"],
            "stars": repo["stars"],
            "language": repo["language"],
            "topics": repo["topics"],
            "category": repo["category"],
            "updated_at": repo["updated_at"],
        })

    PROJECTS_FILE.write_text(
        json.dumps(projects, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    size_kb = PROJECTS_FILE.stat().st_size / 1024
    print(f"📝 {PROJECTS_FILE.name}: {len(projects)} 个项目 ({size_kb:.1f} KB)")


def export_embeddings_json(chunks: list[dict]) -> None:
    """导出向量索引"""
    data = {
        "metadata": {
            "model": EMBEDDING_MODEL,
            "dimension": EMBEDDING_DIMENSIONS,
            "total_chunks": len(chunks),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "chunks": chunks,
    }

    EMBEDDINGS_FILE.write_text(
        json.dumps(data, ensure_ascii=False),
        encoding="utf-8",
    )
    size_mb = EMBEDDINGS_FILE.stat().st_size / (1024 * 1024)
    print(f"📦 {EMBEDDINGS_FILE.name}: {len(chunks)} 个块 ({size_mb:.1f} MB)")


# ========== 主流程 ==========

async def main():
    print("=" * 60)
    print("🏗️  RAG 索引构建")
    print("=" * 60)

    # Step 1: 拉取项目
    print("\n📡 Step 1: 从 GitHub 拉取高星项目...")
    repos = await search_all_categories()

    if not repos:
        print("❌ 没有获取到任何项目，退出")
        return

    # Step 2: 切块
    print(f"\n✂️  Step 2: 切分 README...")
    all_chunks = []
    for repo in repos:
        readme = repo["readme"]
        if not readme:
            continue
        chunks = chunk_readme(readme, repo["full_name"], repo["category"])
        all_chunks.extend(chunks)

    print(f"   共生成 {len(all_chunks)} 个文本块")
    if all_chunks:
        avg_len = sum(len(c["text"]) for c in all_chunks) / len(all_chunks)
        print(f"   平均块长: {avg_len:.0f} 字符")

    # Step 3: Embedding
    print(f"\n🔢 Step 3: Embedding 向量化...")
    embedded_chunks = await embed_all_chunks(all_chunks)

    if not embedded_chunks:
        print("❌ Embedding 全部失败，退出")
        return

    # Step 4: 导出
    print(f"\n💾 Step 4: 导出 JSON...")
    export_projects_json(repos)
    export_embeddings_json(embedded_chunks)

    # 统计
    print(f"\n{'=' * 60}")
    print(f"🎉 索引构建完成!")
    print(f"   项目数: {len(repos)}")
    print(f"   文本块: {len(embedded_chunks)}")
    print(f"   向量维度: {EMBEDDING_DIMENSIONS}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
