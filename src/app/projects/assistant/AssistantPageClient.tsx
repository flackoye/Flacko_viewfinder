'use client';

import { useState, useEffect } from 'react';
import AssistantChat from '@/components/AssistantChat';
import BackgroundCanvas, { BG_PRESETS } from '@/components/StarfieldBackground';

export default function AssistantPageClient() {
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('projects-bg');
    if (saved) setBgIdx(parseInt(saved, 10));
  }, []);

  return (
    <main className="page-fade-in relative min-h-[calc(100vh-10rem)]">
      <BackgroundCanvas presetName={BG_PRESETS[bgIdx].name} />
      <div className="relative z-10">
        <AssistantChat />
      </div>
    </main>
  );
}
