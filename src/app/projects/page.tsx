import type { Project } from '@/lib/project-types';
import { CATEGORIES } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import ProjectLanding from '@/components/ProjectLanding';

export default async function ProjectsPage() {
  // 加载项目数据
  let projects: Project[] = [];
  let embeddingMeta = { model: 'embedding-3', dimension: 512, total_chunks: 0, generated_at: '' };

  try {
    const { data } = await supabase.from('projects').select('*');
    if (data) projects = data as Project[];
  } catch { /* empty */ }

  // 获取 embedding metadata
  try {
    const { count } = await supabase
      .from('embedding_chunks')
      .select('*', { count: 'exact', head: true });
    embeddingMeta.total_chunks = count || 0;
    // generated_at 取最新 chunk 的 created_at
    if (count && count > 0) {
      const { data: latestChunk } = await supabase
        .from('embedding_chunks')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (latestChunk) embeddingMeta.generated_at = latestChunk.created_at;
    }
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
