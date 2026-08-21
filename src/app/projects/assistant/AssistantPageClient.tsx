'use client';

import AssistantChat from '@/components/AssistantChat';
import BackgroundCanvas, { BG_PRESETS } from '@/components/StarfieldBackground';
import { useProjectBackground } from '@/hooks/useProjectBackground';

export default function AssistantPageClient() {
  const [bgIdx] = useProjectBackground();

  return (
    <div className="page-fade-in relative min-h-[calc(100vh-10rem)]">
      <BackgroundCanvas presetName={BG_PRESETS[bgIdx].name} />
      <div className="relative z-10">
        <AssistantChat />
      </div>
    </div>
  );
}
