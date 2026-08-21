'use client';

import type { CategoryInfo } from '@/lib/project-types';
import GuidedExplore from '@/components/GuidedExplore';
import BackgroundCanvas, { BG_PRESETS } from '@/components/StarfieldBackground';
import { useProjectBackground } from '@/hooks/useProjectBackground';

export default function ExplorePageClient({ categories }: { categories: CategoryInfo[] }) {
  const [bgIdx] = useProjectBackground();

  return (
    <div className="page-fade-in relative min-h-[calc(100vh-10rem)]">
      <BackgroundCanvas presetName={BG_PRESETS[bgIdx].name} />
      <div className="relative z-10">
        <GuidedExplore categories={categories} />
      </div>
    </div>
  );
}
