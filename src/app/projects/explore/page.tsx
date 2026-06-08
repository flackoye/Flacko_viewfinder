import type { Project } from '@/lib/project-types';
import { CATEGORIES } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import GuidedExplore from '@/components/GuidedExplore';
import ExplorePageClient from './ExplorePageClient';

export default async function ExplorePage() {
  let projects: Project[] = [];
  try {
    const { data } = await supabase.from('projects').select('*');
    if (data) projects = data as Project[];
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

  return <ExplorePageClient categories={categories} />;
}
