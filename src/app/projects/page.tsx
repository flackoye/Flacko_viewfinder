import fs from 'fs';
import path from 'path';
import type { Project } from '@/lib/project-types';
import { CATEGORIES } from '@/lib/categories';
import ProjectLanding from '@/components/ProjectLanding';

export default async function ProjectsPage() {
  // 加载项目数据
  let projects: Project[] = [];
  let embeddingMeta = { model: 'embedding-3', dimension: 512, total_chunks: 0, generated_at: '' };

  try {
    projects = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'public', 'projects.json'), 'utf-8'),
    );
  } catch { /* empty */ }

  // 轻量提取 embedding metadata（不 parse 整个 40MB 文件）
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'public', 'project_embeddings.json'),
      'utf-8',
    );
    const metaMatch = raw.match(/"metadata"\s*:\s*(\{[^}]+\})/);
    if (metaMatch) embeddingMeta = JSON.parse(metaMatch[1]);
  } catch { /* empty */ }

  // 计算分类统计
  const categoryCounts = new Map<string, number>();
  for (const p of projects) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1);
  }

  const categories = CATEGORIES.map(c => ({
    ...c,
    projectCount: categoryCounts.get(c.name) || 0,
  }));

  return (
    <ProjectLanding
      totalProjects={projects.length}
      totalChunks={embeddingMeta.total_chunks}
      dimension={embeddingMeta.dimension}
      generatedAt={embeddingMeta.generated_at}
      categories={categories}
    />
  );
}
