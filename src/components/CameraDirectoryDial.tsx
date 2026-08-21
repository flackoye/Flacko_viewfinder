'use client';

import { ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const directoryItems = [
  { label: '个人档案', href: '/about' },
  { label: '文章', href: '/records' },
  { label: '更新日志', href: '/changelog' },
  { label: 'AI 热点', href: '/trending' },
  { label: '项目索引', href: '/projects' },
  { label: 'GitHub', href: 'https://github.com/flackoye', external: true },
];

type DirectoryStyle = CSSProperties & {
  '--directory-progress': string;
  '--directory-rotation': string;
};

export default function CameraDirectoryDial() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelDeltaRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const wheelRef = useRef<HTMLButtonElement>(null);
  const activeItem = directoryItems[activeIndex];
  const style: DirectoryStyle = {
    '--directory-progress': `${(activeIndex / (directoryItems.length - 1)) * 100}%`,
    '--directory-rotation': `${activeIndex * 42}deg`,
  };

  const changeDirectory = useCallback((direction: -1 | 1) => {
    setActiveIndex((current) => (
      (current + direction + directoryItems.length) % directoryItems.length
    ));
  }, []);

  const processWheel = useCallback((delta: number) => {
    wheelDeltaRef.current += delta;
    if (Math.abs(wheelDeltaRef.current) < 24) return;

    const now = performance.now();
    if (now - lastStepAtRef.current < 130) {
      wheelDeltaRef.current = 0;
      return;
    }
    changeDirectory(wheelDeltaRef.current > 0 ? 1 : -1);
    wheelDeltaRef.current = 0;
    lastStepAtRef.current = now;
  }, [changeDirectory]);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      processWheel(event.deltaY || event.deltaX);
    };
    wheel.addEventListener('wheel', handleWheel, { passive: false });
    return () => wheel.removeEventListener('wheel', handleWheel);
  }, [processWheel]);

  const navigateToActive = () => {
    if (activeItem.external) {
      window.open(activeItem.href, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(activeItem.href);
  };

  return (
    <div className="camera-directory" style={style}>
      <span className="camera-directory__state">DIR</span>
      <button
        type="button"
        className="camera-directory__current"
        onClick={navigateToActive}
        aria-label={`前往${activeItem.label}`}
      >
        <span>{String(activeIndex + 1).padStart(2, '0')}</span>
        <strong key={activeItem.href} aria-live="polite">{activeItem.label}</strong>
        <ArrowUpRight />
      </button>
      <span className="camera-directory__meter" aria-hidden><span /></span>
      <button
        ref={wheelRef}
        type="button"
        className="camera-directory__wheel"
        onClick={() => changeDirectory(1)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            changeDirectory(-1);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            changeDirectory(1);
          }
        }}
        aria-label={`当前目录：${activeItem.label}。滚动鼠标滚轮选择；点击切换下一项`}
      >
        <span className="camera-directory__wheel-face"><span /></span>
        <span className="camera-directory__hint" aria-hidden>滚轮选择</span>
      </button>
    </div>
  );
}
