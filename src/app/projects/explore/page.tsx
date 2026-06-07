import fs from 'fs';
import path from 'path';
import type { Project } from '@/lib/project-types';
import { CATEGORIES } from '@/lib/categories';
import GuidedExplore from '@/components/GuidedExplore';
import ExplorePageClient from './ExplorePageClient';

export default async function ExplorePage() {
  let projects: Project[] = [];
  try {
    projects = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'public', 'projects.json'), 'utf-8'),
    );
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
