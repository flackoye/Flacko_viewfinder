'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

/** 说话气泡内容 */
const SPEECH_BUBBLES = [
  '嘿！别点我 😤',
  '又来？你很烦诶 😒',
  '🎵 思念是一种病～',
  '别闹了，我在休息 💤',
  '点我也不会有彩蛋的 🙄',
  '你是不是太闲了？🤨',
  '再点我就报警了！🚨',
  '今天也要加油啊 💪',
  '我喜欢待在这里 🏠',
  '你看起来心情不错 😎',
  '偷偷告诉你...我是个歌手 🎤',
  '放心，我会一直陪着你 🫶',
];

/** 宠物状态 */
type PetState = 'idle' | 'hover' | 'clicked' | 'dragging';

export default function PetCharacter() {
  const [state, setState] = useState<PetState>('idle');
  const [position, setPosition] = useState({ x: 24, y: 24 }); // 左下角偏移
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [clickCount, setClickCount] = useState(0);
  const [isHidden, setIsHidden] = useState(false);

  const petRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBubbleIndex = useRef(-1);

  /** 显示随机气泡 */
  const showBubble = useCallback(() => {
    // 避免连续重复
    let idx: number;
    do {
      idx = Math.floor(Math.random() * SPEECH_BUBBLES.length);
    } while (idx === lastBubbleIndex.current && SPEECH_BUBBLES.length > 1);
    lastBubbleIndex.current = idx;

    setBubble(SPEECH_BUBBLES[idx]);
    setBubbleVisible(true);

    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => {
      setBubbleVisible(false);
    }, 3000);
  }, []);

  /** 处理点击 */
  const handleClick = useCallback(() => {
    if (isDragging) return;
    setState('clicked');
    setClickCount(prev => prev + 1);
    showBubble();

    setTimeout(() => {
      setState(prev => (prev === 'clicked' ? 'idle' : prev));
    }, 600);
  }, [isDragging, showBubble]);

  /** 拖拽开始 */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!petRef.current) return;
      e.preventDefault();
      const rect = petRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setIsDragging(false);
      setState('dragging');
      petRef.current.setPointerCapture(e.pointerId);
    },
    []
  );

  /** 拖拽移动 */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (state !== 'dragging') return;
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        setIsDragging(true);
      }

      const newX = window.innerWidth - e.clientX + dragOffset.x - 120;
      const newY = window.innerHeight - e.clientY + dragOffset.y - 120;
      setPosition({
        x: Math.max(0, Math.min(newX, window.innerWidth - 120)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 120)),
      });
    },
    [state, dragOffset]
  );

  /** 拖拽结束 */
  const handlePointerUp = useCallback(() => {
    if (state !== 'dragging') return;
    if (!isDragging) {
      // 没有实际拖动 → 视为点击
      handleClick();
    }
    setState('idle');
    setIsDragging(false);
  }, [state, isDragging, handleClick]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, []);

  return (
    <>
      {/* 隐藏/显示按钮 */}
      <button
        onClick={() => setIsHidden(prev => !prev)}
        className="fixed bottom-6 left-6 z-[60] w-8 h-8 rounded-full glass-btn flex items-center justify-center text-xs text-text-muted hover:text-accent transition-colors"
        title={isHidden ? '显示小宠物' : '隐藏小宠物'}
        style={{ opacity: isHidden ? 1 : 0, pointerEvents: isHidden ? 'auto' : 'none' }}
      >
        🎵
      </button>

      {/* 宠物主体 */}
      <div
        ref={petRef}
        className="fixed z-50 select-none"
        style={{
          left: position.x,
          bottom: position.y,
          width: 120,
          height: 120,
          cursor: state === 'dragging' ? 'grabbing' : 'grab',
          opacity: isHidden ? 0 : 1,
          pointerEvents: isHidden ? 'none' : 'auto',
          transition: isDragging ? 'none' : 'opacity 0.3s',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => {
          if (state !== 'dragging') setState('hover');
        }}
        onMouseLeave={() => {
          if (state !== 'dragging') setState('idle');
        }}
      >
        {/* 说话气泡 */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium
            bg-white/10 backdrop-blur-md border border-white/15 text-text shadow-lg"
          style={{
            opacity: bubbleVisible ? 1 : 0,
            transform: `translateX(-50%) translateY(${bubbleVisible ? '0' : '8px'})`,
            transition: 'opacity 0.3s, transform 0.3s',
            pointerEvents: 'none',
          }}
        >
          {bubble}
          {/* 气泡小三角 */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45
              bg-white/10 border-b border-r border-white/15"
          />
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(true);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-bg-card border border-border
            flex items-center justify-center text-[10px] text-text-muted hover:text-accent transition-colors"
          style={{
            opacity: state === 'hover' || state === 'clicked' ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
          title="隐藏"
        >
          ✕
        </button>

        {/* 宠物图片 */}
        <div
          className="w-full h-full"
          style={{
            animation:
              state === 'idle'
                ? 'pet-idle 3s ease-in-out infinite'
                : state === 'clicked'
                  ? 'pet-jump 0.5s ease-out'
                  : state === 'hover'
                    ? 'pet-hover 1.5s ease-in-out infinite'
                    : 'none',
            filter:
              state === 'hover'
                ? 'brightness(1.1) drop-shadow(0 0 12px rgba(226,182,89,0.3))'
                : state === 'clicked'
                  ? 'brightness(1.2) drop-shadow(0 0 16px rgba(226,182,89,0.5))'
                  : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            transition: 'filter 0.3s',
          }}
        >
          <Image
            src="/pet-character.png"
            alt="小宠物"
            width={120}
            height={120}
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </div>
      </div>
    </>
  );
}
