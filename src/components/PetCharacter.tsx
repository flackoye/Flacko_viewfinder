'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/components/SettingsProvider';

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
const POSITION_KEY = 'pet-position-x';
const EDGE_PADDING = 12;

type PetAction = 'idle' | 'walking' | 'clicked' | 'dragging';
type Facing = -1 | 1;

interface DragSession {
  pointerId: number;
  startClientX: number;
  startX: number;
  moved: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function PetCharacter() {
  const { settings, update } = useSettings();
  const [action, setAction] = useState<PetAction>('idle');
  const [isHovered, setIsHovered] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [positionX, setPositionX] = useState(EDGE_PADDING);
  const [moveDuration, setMoveDuration] = useState(0);
  const [facing, setFacing] = useState<Facing>(1);
  const [lookX, setLookX] = useState(0);
  const [lookRotation, setLookRotation] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(positionX);
  const dragRef = useRef<DragSession | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLyricIndex = useRef(-1);
  const isHidden = !settings.petVisible;

  const getMaxPosition = useCallback(() => {
    if (typeof window === 'undefined') return EDGE_PADDING;
    const shellWidth = shellRef.current?.offsetWidth ?? 170;
    return Math.max(EDGE_PADDING, window.innerWidth - shellWidth - EDGE_PADDING);
  }, []);

  const clampPosition = useCallback(
    (value: number) => clamp(value, EDGE_PADDING, getMaxPosition()),
    [getMaxPosition],
  );

  const clearActionTimer = useCallback(() => {
    if (!actionTimer.current) return;
    clearTimeout(actionTimer.current);
    actionTimer.current = null;
  }, []);

  useEffect(() => {
    positionRef.current = positionX;
  }, [positionX]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches);
    const updateBounds = () => {
      setViewportWidth(window.innerWidth);
      setPositionX((current) => clampPosition(current));
    };

    const initialFrame = requestAnimationFrame(() => {
      const savedPosition = Number.parseFloat(localStorage.getItem(POSITION_KEY) ?? '');
      setPositionX(Number.isFinite(savedPosition) ? clampPosition(savedPosition) : EDGE_PADDING);
      updateMotionPreference();
      updateBounds();
    });

    mediaQuery.addEventListener('change', updateMotionPreference);
    window.addEventListener('resize', updateBounds);
    const enterTimer = setTimeout(() => setEntered(true), 120);

    return () => {
      clearTimeout(enterTimer);
      cancelAnimationFrame(initialFrame);
      mediaQuery.removeEventListener('change', updateMotionPreference);
      window.removeEventListener('resize', updateBounds);
    };
  }, [clampPosition]);

  useEffect(() => {
    if (!entered || isHidden || !settings.petRoaming || reduceMotion || isHovered || action !== 'idle') return;

    const roamTimer = setTimeout(() => {
      const current = positionRef.current;
      const maxPosition = getMaxPosition();
      const availableWidth = maxPosition - EDGE_PADDING;
      if (availableWidth < 120) return;

      let direction: Facing;
      if (current < EDGE_PADDING + availableWidth * 0.22) direction = 1;
      else if (current > EDGE_PADDING + availableWidth * 0.78) direction = -1;
      else direction = Math.random() > 0.5 ? 1 : -1;

      const maxStride = Math.min(320, Math.max(120, availableWidth * 0.32));
      const distance = 90 + Math.random() * Math.max(30, maxStride - 90);
      const target = clampPosition(current + direction * distance);
      const actualDistance = Math.abs(target - current);
      if (actualDistance < 48) return;

      const duration = clamp(actualDistance / 82, 1.2, 3.6);
      setFacing(direction);
      setMoveDuration(duration);
      setPositionX(target);
      setAction('walking');
      clearActionTimer();
      actionTimer.current = setTimeout(() => {
        setAction('idle');
        actionTimer.current = null;
      }, duration * 1000);
    }, 6000 + Math.random() * 5000);

    return () => clearTimeout(roamTimer);
  }, [action, clearActionTimer, clampPosition, entered, getMaxPosition, isHidden, isHovered, reduceMotion, settings.petRoaming]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPositionX((current) => clampPosition(current));
    });
    return () => cancelAnimationFrame(frame);
  }, [clampPosition, settings.petScale, viewportWidth]);

  useEffect(() => {
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      clearActionTimer();
    };
  }, [clearActionTimer]);

  const bumpVisitCount = useCallback(() => {
    const raw = sessionStorage.getItem(VISIT_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    const previous = Number.isFinite(parsed) ? parsed : 0;
    const next = previous + 1;
    sessionStorage.setItem(VISIT_KEY, String(next));
    return next;
  }, []);

  const getRandomLyric = useCallback(() => {
    let index: number;
    do {
      index = Math.floor(Math.random() * LYRICS_POOL.length);
    } while (index === lastLyricIndex.current && LYRICS_POOL.length > 1);
    lastLyricIndex.current = index;
    return LYRICS_POOL[index];
  }, []);

  const showBubble = useCallback((text: string) => {
    setBubble(text);
    setBubbleVisible(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubbleVisible(false), 4500);
  }, []);

  const handleClick = useCallback(() => {
    clearActionTimer();
    setMoveDuration(0);
    setAction('clicked');
    const clickNumber = bumpVisitCount();
    if (clickNumber === 1) showBubble(GREETING_FIRST);
    else if (clickNumber === 2) showBubble(GREETING_SECOND);
    else showBubble(getRandomLyric());

    actionTimer.current = setTimeout(() => {
      setAction('idle');
      actionTimer.current = null;
    }, 760);
  }, [bumpVisitCount, clearActionTimer, getRandomLyric, showBubble]);

  const freezeAtRenderedPosition = useCallback(() => {
    const renderedLeft = moverRef.current?.getBoundingClientRect().left;
    if (renderedLeft === undefined) return positionRef.current;
    const frozenPosition = clampPosition(renderedLeft);
    setMoveDuration(0);
    setPositionX(frozenPosition);
    positionRef.current = frozenPosition;
    return frozenPosition;
  }, [clampPosition]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-close-btn]')) return;
    clearActionTimer();
    const startX = freezeAtRenderedPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startX,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setAction('dragging');
    setLookX(0);
    setLookRotation(0);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const delta = event.clientX - drag.startClientX;
      if (Math.abs(delta) > 4) drag.moved = true;
      if (!drag.moved) return;
      setFacing(delta < 0 ? -1 : 1);
      const nextPosition = clampPosition(drag.startX + delta);
      positionRef.current = nextPosition;
      setPositionX(nextPosition);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2), -1, 1);
    setLookX(ratio * 4);
    setLookRotation(ratio * 1.8);
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerInside = event.pointerType !== 'touch'
      && event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom;
    setIsHovered(pointerInside);
    if (!pointerInside) {
      setLookX(0);
      setLookRotation(0);
    }

    if (drag.moved) {
      const settledPosition = clampPosition(positionRef.current);
      setPositionX(settledPosition);
      localStorage.setItem(POSITION_KEY, String(Math.round(settledPosition)));
      setAction('idle');
    } else if (!cancelled) {
      handleClick();
    } else {
      setAction('idle');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleClick();
  };

  const effectiveAction = action === 'walking' && !settings.petRoaming ? 'idle' : action;
  const showClose = isHovered || effectiveAction === 'clicked' || effectiveAction === 'dragging';
  const visualState = effectiveAction === 'idle' && isHovered ? 'curious' : effectiveAction;
  const bubbleOnLeft = viewportWidth > 0 && positionX > viewportWidth * 0.58;
  const compactPet = viewportWidth > 0 && viewportWidth < 480;
  const normalizedScale = clamp(settings.petScale, 70, 140) / 100;
  const petDimensions = {
    '--pet-width': `${(compactPet ? 120 : 170) * normalizedScale}px`,
    '--pet-height': `${(compactPet ? 170 : 240) * normalizedScale}px`,
  } as CSSProperties;

  return (
    <>
      <button
        onClick={() => update({ petVisible: true })}
        className="pet-summon fixed z-[60] flex h-10 w-10 items-center justify-center rounded-full text-lg"
        style={{
          left: 24,
          bottom: 24,
          opacity: isHidden ? 1 : 0,
          pointerEvents: isHidden ? 'auto' : 'none',
          transform: isHidden ? 'scale(1)' : 'scale(0.8)',
        }}
        aria-label="召唤阿岳"
        title="召唤阿岳"
      >
        🎵
      </button>

      <div
        ref={moverRef}
        className="pet-mover fixed bottom-0 left-0 z-50 select-none"
        style={{
          ...petDimensions,
          transform: `translate3d(${positionX}px, 0, 0)`,
          transitionProperty: 'transform',
          transitionDuration: effectiveAction === 'walking' ? `${moveDuration}s` : '0s',
          transitionTimingFunction: 'linear',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={shellRef}
          className={`pet-shell pet-shell--${visualState}`}
          style={{
            opacity: isHidden || !entered ? 0 : 1,
            pointerEvents: isHidden ? 'none' : 'auto',
            transform: isHidden
              ? 'translateY(28px) scale(0.72)'
              : entered
                ? 'translateY(0) scale(1)'
                : 'translateY(100%) scale(0.92)',
          }}
          role="button"
          tabIndex={isHidden ? -1 : 0}
          aria-label="阿岳。点击听他说话，拖动可以移动位置"
          title="点击阿岳，或拖动他换个位置"
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointerInteraction(event)}
          onPointerCancel={(event) => finishPointerInteraction(event, true)}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => {
            if (!dragRef.current) {
              setIsHovered(false);
              setLookX(0);
              setLookRotation(0);
            }
          }}
        >
          <div
            className={`pet-bubble pet-bubble--${bubbleOnLeft ? 'left' : 'right'}`}
            data-visible={bubbleVisible}
            aria-live="polite"
          >
            <span className="pet-note-icon" aria-hidden>🎤</span>
            <span>{bubble}</span>
            <span className="pet-bubble__tail" aria-hidden />
          </div>

          <button
            data-close-btn="true"
            onClick={(event) => {
              event.stopPropagation();
              update({ petVisible: false });
              setBubbleVisible(false);
              clearActionTimer();
              setAction('idle');
            }}
            className="pet-close"
            style={{
              opacity: showClose ? 1 : 0,
              pointerEvents: showClose ? 'auto' : 'none',
            }}
            aria-label="让阿岳休息"
            title="让阿岳休息"
          >
            ✕
          </button>

          <div className={`pet-motion pet-motion--${visualState}`}>
            <div
              className="pet-gaze"
              style={{ transform: `translateX(${lookX}px) rotate(${lookRotation}deg)` }}
            >
              <div className="pet-facing" style={{ transform: `scaleX(${facing})` }}>
                <Image
                  src="/pet-ayue.png"
                  alt="阿岳"
                  width={170}
                  height={240}
                  className="h-full w-full object-contain pointer-events-none"
                  draggable={false}
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
