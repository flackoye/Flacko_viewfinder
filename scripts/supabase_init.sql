-- ============================================================
-- 万象索骥 RAG — Supabase pgvector 初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 项目元数据表（替代 projects.json）
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  full_name   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  html_url    TEXT NOT NULL,
  stars       INTEGER NOT NULL DEFAULT 0,
  language    TEXT,
  topics      JSONB NOT NULL DEFAULT '[]',
  category    TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects (category);

-- 3. Embedding chunks 表（替代 project_embeddings.json）
CREATE TABLE IF NOT EXISTS embedding_chunks (
  id              TEXT PRIMARY KEY,
  repo_full_name  TEXT NOT NULL,
  category        TEXT NOT NULL,
  section_title   TEXT NOT NULL DEFAULT '',
  chunk_index     INTEGER NOT NULL DEFAULT 0,
  text            TEXT NOT NULL,
  embedding       vector(512) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_category ON embedding_chunks (category);
CREATE INDEX IF NOT EXISTS idx_chunks_repo ON embedding_chunks (repo_full_name);

-- 4. HNSW 索引（近似最近邻，余弦距离）
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_cosine ON embedding_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. RPC 函数：向量检索（替代 retrieveTopK）
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding  vector(512),
  match_count      INTEGER DEFAULT 5,
  filter_category  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id             TEXT,
  repo_full_name TEXT,
  category       TEXT,
  section_title  TEXT,
  chunk_index    INTEGER,
  text           TEXT,
  score          FLOAT
)
LANGUAGE plpgsql
-- 数据量目前只有数千个 chunk。分类检索优先保证结果完整性，避免 HNSW
-- 先取全局近邻、再应用 category 条件时把某个小分类全部过滤掉。
SET enable_indexscan = off
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.repo_full_name,
    ec.category,
    ec.section_title,
    ec.chunk_index,
    ec.text,
    1 - (ec.embedding <=> query_embedding) AS score
  FROM embedding_chunks ec
  WHERE filter_category IS NULL OR ec.category = filter_category
  ORDER BY ec.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. 线上访问只经过服务端 service_role 客户端；禁止 anon 直接读取原始语料。
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_chunks ENABLE ROW LEVEL SECURITY;
