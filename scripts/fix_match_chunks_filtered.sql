-- 修复带分类条件的向量检索偶发返回空结果。
--
-- 原因：HNSW 是近似索引。PostgreSQL 可能先从全量向量中取近邻候选，
-- 再应用 category 过滤；Data & Training 这类较小分类可能因此没有候选。
-- 当前只有数千个 chunk，函数内使用精确扫描更稳定，性能开销也可控。
--
-- 在 Supabase Dashboard -> SQL Editor 中完整执行本文件。

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
