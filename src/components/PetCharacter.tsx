'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

/** 🎵 台词 — 气泡自适应宽度，移动端允许换行 */
const GREETING_FIRST = '大家好，我是阿岳 ✌️';
const GREETING_SECOND = '山林老北来给你唱歌啦 🎤';
const LYRICS_POOL = [
  '把生命浪费在美好的事物上 🌿',
  '上坡要努力，下坡要开心 🚴',
  '哎呦喂呀，谁是我的老婆 😏',
  '逝去的过往，就别再回头望 🌊',
  '在凌晨两点十分慌张想你，吸着无法入眠的空气 🌙',
  '一个人走，去你妈的路口 🎸',
  '择期不如就今天，Bye-bye Blue Monday 🎉',
  '总有些惊奇的际遇，比方说当我遇见你 💫',
  '吃汉堡，我每天吃八个 🍔',
  '我们都已经长大了，就再也回不去 😢',
  '当你在穿山越岭的另一边 🏔️',
  '爱我别走 ❤️',
];

const VISIT_KEY = 'pet-visit-count';

type PetState = 'idle' | 'hover' | 'clicked';

export default function PetCharacter() {
  const [state, setState] = useState<PetState>('idle');
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [entered, setEntered] = useState(false); // 首次进场动画

  const PET_WIDTH = isMobile ? 120 : 170;
  const PET_HEIGHT = isMobile ? 170 : 240;

  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLyricIndex = useRef(-1);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    // 首次进场：mounted 后短暂延迟触发探头动画
    const enterTimer = setTimeout(() => setEntered(true), 120);
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(enterTimer);
    };
  }, []);

  const bumpVisitCount = useCallback((): number => {
    const raw = sessionStorage.getItem(VISIT_KEY);
    const prev = raw ? parseInt(raw, 10) : 0;
    const next = prev + 1;
    sessionStorage.setItem(VISIT_KEY, String(next));
    return next;
  }, []);

  const getRandomLyric = useCallback((): string => {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * LYRICS_POOL.length);
    } while (idx === lastLyricIndex.current && LYRICS_POOL.length > 1);
    lastLyricIndex.current = idx;
    return LYRICS_POOL[idx];
  }, []);

  const showBubble = useCallback((text: string) => {
    setBubble(text);
    setBubbleVisible(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubbleVisible(false), 4500);
  }, []);

  const handleClick = useCallback(() => {
    setState('clicked');
    const clickNum = bumpVisitCount();
    if (clickNum === 1) showBubble(GREETING_FIRST);
    else if (clickNum === 2) showBubble(GREETING_SECOND);
    else showBubble(getRandomLyric());
    setTimeout(() => setState(prev => (prev === 'clicked' ? 'idle' : prev)), 700);
  }, [showBubble, bumpVisitCount, getRandomLyric]);

  useEffect(() => {
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, []);

  if (!mounted) return null;

  const showClose = state === 'hover' || state === 'clicked';
  // 首次进场前：藏在屏幕下方 + 左倾
  const entering = !entered;

  return (
    <>
      {/* 隐藏后的恢复按钮 */}
      <button
        onClick={() => setIsHidden(false)}
        className="fixed z-[60] w-10 h-10 rounded-full flex items-center justify-center text-lg
          hover:scale-110 active:scale-95 transition-all duration-300"
        style={{
          left: 32,
          bottom: 32,
          background: 'rgba(226, 182, 89, 0.12)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(226, 182, 89, 0.2)',
          opacity: isHidden ? 1 : 0,
          pointerEvents: isHidden ? 'auto' : 'none',
          transform: isHidden ? 'scale(1)' : 'scale(0.8)',
          color: 'var(--color-accent)',
        }}
        title="召唤阿岳"
      >
        🎵
      </button>

      {/* 外层 wrapper：比宠物大一圈，给关闭按钮留空间 */}
      <div
        className="fixed z-50 select-none"
        style={{
          left: 4,
          bottom: 0,
          width: PET_WIDTH + 24,
          height: PET_HEIGHT + 24,
          padding: 12,
          cursor: 'pointer',
          opacity: isHidden ? 0 : entering ? 0 : 1,
          pointerEvents: isHidden ? 'none' : 'auto',
          transform: isHidden
            ? 'scale(0.5) translateY(20px)'
            : entering
              ? 'translateY(120%) rotate(-8deg)'
              : 'translateY(0) rotate(0)',
          transition: isHidden
            ? 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : entered
              ? 'opacity 0.4s ease, transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'none',
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-close-btn]')) return;
          handleClick();
        }}
        onMouseEnter={() => {
          if (state !== 'clicked') setState('hover');
        }}
        onMouseLeave={() => {
          if (state !== 'clicked') setState('idle');
        }}
      >
        {/* ===== 脚下金色光晕（地面投影） ===== */}
        <div
          className="pet-ground-glow"
          style={{
            opacity: state === 'clicked' ? 0.9 : state === 'hover' ? 0.7 : 0.5,
            width: PET_WIDTH * 0.9,
            bottom: 6,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ===== 进场音符（首次进场时从头顶飘出） ===== */}
        {entered && (
          <>
            <span className="pet-enter-note" style={{ left: '40%', bottom: PET_HEIGHT * 0.8, animationDelay: '0ms' }}>🎵</span>
            <span className="pet-enter-note" style={{ left: '55%', bottom: PET_HEIGHT * 0.85, animationDelay: '180ms' }}>🎶</span>
            <span className="pet-enter-note" style={{ left: '48%', bottom: PET_HEIGHT * 0.78, animationDelay: '360ms' }}>🎵</span>
          </>
        )}

        {/* ===== 说话气泡（右上角，桌面端体面宽度，移动端自适应换行） ===== */}
        <div
          className="pet-bubble absolute rounded-2xl px-5 py-3 text-[15px] font-medium leading-relaxed flex items-center gap-2"
          style={{
            left: PET_WIDTH * 0.55 + 12,
            bottom: '88%',
            opacity: bubbleVisible ? 1 : 0,
            transform: bubbleVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.92)',
            transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(226,182,89,0.14), rgba(255,255,255,0.07))',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(226, 182, 89, 0.22)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset',
            color: 'var(--color-text)',
          }}
        >
          <span className="pet-note-icon" aria-hidden>🎤</span>
          <span>{bubble}</span>
          <div
            className="absolute -left-[6px] bottom-3 w-3 h-3 rotate-45"
            style={{
              background: 'linear-gradient(135deg, rgba(226,182,89,0.14), rgba(255,255,255,0.07))',
              borderLeft: '1px solid rgba(226, 182, 89, 0.22)',
              borderBottom: '1px solid rgba(226, 182, 89, 0.22)',
            }}
          />
        </div>

        {/* ===== 关闭按钮 ===== */}
        <button
          data-close-btn="true"
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(true);
          }}
          className="absolute top-1 left-1 w-7 h-7 rounded-full flex items-center justify-center
            text-sm transition-all duration-200 hover:scale-125 active:scale-90 z-10"
          style={{
            opacity: showClose ? 1 : 0,
            pointerEvents: showClose ? 'auto' : 'none',
            background: 'rgba(18, 20, 28, 0.9)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--color-text-muted)',
            backdropFilter: 'blur(8px)',
          }}
          title="让阿岳休息"
        >
          ✕
        </button>

        {/* ===== 宠物图片 ===== */}
        <div
          className="w-full h-full"
          style={{
            animation:
              state === 'idle'
                ? 'pet-idle 3s ease-in-out infinite'
                : state === 'clicked'
                  ? 'pet-jump 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : state === 'hover'
                    ? 'pet-hover 1.2s ease-in-out infinite'
                    : 'none',
            filter:
              state === 'hover'
                ? 'brightness(1.08) drop-shadow(0 0 18px rgba(226,182,89,0.35))'
                : state === 'clicked'
                  ? 'brightness(1.15) drop-shadow(0 0 28px rgba(226,182,89,0.5))'
                  : 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))',
            transition: 'filter 0.3s ease',
          }}
        >
          <Image
            src="/pet-ayue.png"
            alt="阿岳"
            width={PET_WIDTH}
            height={PET_HEIGHT}
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
            priority
          />
        </div>

        {/* ===== 点击粒子效果 ===== */}
        {state === 'clicked' && (
          <>
            <span className="pet-particle" style={{ '--delay': '0ms', '--angle': '30deg', left: '30%', top: '30%' } as React.CSSProperties} />
            <span className="pet-particle" style={{ '--delay': '50ms', '--angle': '70deg', left: '50%', top: '20%' } as React.CSSProperties} />
            <span className="pet-particle" style={{ '--delay': '100ms', '--angle': '120deg', left: '60%', top: '40%' } as React.CSSProperties} />
            <span className="pet-particle" style={{ '--delay': '60ms', '--angle': '170deg', left: '70%', top: '30%' } as React.CSSProperties} />
            <span className="pet-particle" style={{ '--delay': '30ms', '--angle': '220deg', left: '40%', top: '50%' } as React.CSSProperties} />
            <span className="pet-particle" style={{ '--delay': '80ms', '--angle': '290deg', left: '55%', top: '45%' } as React.CSSProperties} />
          </>
        )}
      </div>
    </>
  );
}
