'use client';

/**
 * 极简对角线揭角（CSS clip-path 实现，无需 WebGL）
 *
 * 揭角从右上角开始，沿对角线向左下角传播。
 * 分为两段：
 *   1. 盖布（0~60ms）：暖色布瞬间覆盖全屏
 *   2. 揭角（60~760ms）：clip-path 5 点多边形从右下角沿对角线收拢
 *
 * 首次进入也会播一次。
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type Phase = 'idle' | 'cover' | 'peel';

export default function PaperCrumpleTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('cover');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    setPhase('cover');
    const t1 = setTimeout(() => setPhase('peel'), 60);
    const t2 = setTimeout(() => {
      setPhase('idle');
      started.current = false;
    }, 820);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      started.current = false;
    };
  }, [pathname]);

  if (phase === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden" aria-hidden>
      {/* 暖色布料层 */}
      <div
        className="absolute inset-0 bg-[#e8ddc8]"
        style={{
          clipPath:
            phase === 'cover'
              ? 'polygon(0% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%)'
              : 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 100%, 0% 100%)',
          transition: 'clip-path 0.7s cubic-bezier(0.4, 0.0, 0.3, 1.0)',
          willChange: 'clip-path',
        }}
      />
    </div>
  );
}
