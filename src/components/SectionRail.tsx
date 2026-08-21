'use client';

import { Aperture, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SectionRail() {
  const [pointsUp, setPointsUp] = useState(false);

  useEffect(() => {
    let frame = 0;

    const updateDirection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const writingSection = document.getElementById('writing');
        if (!writingSection) return;
        const changePoint = writingSection.offsetTop - window.innerHeight * 0.48;
        setPointsUp(window.scrollY >= changePoint);
      });
    };

    updateDirection();
    window.addEventListener('scroll', updateDirection, { passive: true });
    window.addEventListener('resize', updateDirection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateDirection);
      window.removeEventListener('resize', updateDirection);
    };
  }, []);

  const handleClick = () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (pointsUp) {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    document.getElementById('writing')?.scrollIntoView({ behavior, block: 'start' });
  };

  return (
    <button
      type="button"
      className="section-rail"
      data-direction={pointsUp ? 'up' : 'down'}
      onClick={handleClick}
      aria-label={pointsUp ? '返回首页顶部' : '前往文章区域'}
    >
      <span className="section-rail__label" aria-hidden>
        {pointsUp ? '返回首页' : '下一幕 · 文章'}
      </span>
      <span className="section-rail__track" aria-hidden>
        <span className="section-rail__line" />
        <span className="section-rail__thumb">
          <Aperture />
        </span>
        {pointsUp ? <ChevronUp className="section-rail__arrow" /> : <ChevronDown className="section-rail__arrow" />}
      </span>
    </button>
  );
}
