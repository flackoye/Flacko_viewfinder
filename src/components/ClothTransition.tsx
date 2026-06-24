'use client';

/**
 * 页面切换特效：斜角布料揭盖（clip-path 实现）
 *
 * 视觉流程：
 *   1. mount（0ms）     : 布料以全屏覆盖形态立即出现（无滑入，不闪页面）
 *   2. peel（50ms 后） : 布料从右下角向左上角斜向揭开（clip-path 多边形收缩），
 *                         翻折边缘含渐变阴影模拟布料折叠光影
 *   3. idle（800ms 后） : 组件卸载，新页面完全可见
 *
 * 动画曲线 cubic-bezier(0.34, 1.05, 0.64, 1)：
 *   - overshoot 1.05 > 1 → 末端轻微回弹，模拟布料被扯后自然缓停
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type Phase = 'idle' | 'cover' | 'peel';

export default function ClothTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('cover'); // 首次进入即全屏覆盖
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // 初始渲染即 phase=cover → 布料立即全屏（无动画，不会闪出新页面）
    setPhase('cover');

    // 等待一帧（50ms）后开始揭盖
    const t1 = setTimeout(() => setPhase('peel'), 50);

    // 揭盖完成后卸载
    const t2 = setTimeout(() => {
      setPhase('idle');
      started.current = false;
    }, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      started.current = false;
    };
  }, [pathname]);

  if (phase === 'idle') return null;

  return (
    <div className={`cloth-overlay ${phase}`} aria-hidden>
      <div className="cloth-fabric" />
    </div>
  );
}
