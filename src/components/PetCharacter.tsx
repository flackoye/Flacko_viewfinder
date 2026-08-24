'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
import { PET_VIEWFINDER_EVENT, type PetViewfinderEventDetail } from '@/lib/pet-events';

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
const FIXED_SCALE = 0.7;

type PetAction =
  | 'idle'
  | 'dragging'
  | 'resting'
  | 'sitting'
  | 'guitar-ready'
  | 'guitar-playing'
  | 'guitar-rest'
  | 'waving'
  | 'startled'
  | 'stretching'
  | 'yawning';
type Facing = -1 | 1;
type ViewfinderMode = 'none' | 'departing' | 'peek' | 'returning';

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
  const pathname = usePathname();
  const [action, setAction] = useState<PetAction>('idle');
  const [isHovered, setIsHovered] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [positionX, setPositionX] = useState(EDGE_PADDING);
  const [viewfinderX, setViewfinderX] = useState(EDGE_PADDING);
  const [viewfinderY, setViewfinderY] = useState(0);
  const [viewfinderMode, setViewfinderMode] = useState<ViewfinderMode>('none');
  const [facing, setFacing] = useState<Facing>(1);
  const [lookX, setLookX] = useState(0);
  const [lookRotation, setLookRotation] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activitySignal, setActivitySignal] = useState(0);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(positionX);
  const actionRef = useRef(action);
  const dragRef = useRef<DragSession | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewfinderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverStartedAt = useRef(0);
  const hoverCanTrigger = useRef(false);
  const wavePlayedForHover = useRef(false);
  const startleCooldownUntil = useRef(0);
  const lastIdleActionAt = useRef(0);
  const lastScrollY = useRef(0);
  const activityThrottleAt = useRef(0);
  const lastLyricIndex = useRef(-1);
  const isHidden = !settings.petVisible;

  const getMaxPosition = useCallback(() => {
    if (typeof window === 'undefined') return EDGE_PADDING;
    const shellWidth = shellRef.current?.offsetWidth ?? 119;
    return Math.max(EDGE_PADDING, window.innerWidth - shellWidth - EDGE_PADDING);
  }, []);

  const clampPosition = useCallback(
    (value: number) => clamp(value, EDGE_PADDING, getMaxPosition()),
    [getMaxPosition],
  );

  const clearPhaseTimer = useCallback(() => {
    if (!phaseTimer.current) return;
    clearTimeout(phaseTimer.current);
    phaseTimer.current = null;
  }, []);

  const clearAutoTimer = useCallback(() => {
    if (!autoTimer.current) return;
    clearTimeout(autoTimer.current);
    autoTimer.current = null;
  }, []);

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimer.current) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);

  const clearBottomTimer = useCallback(() => {
    if (!bottomTimer.current) return;
    clearTimeout(bottomTimer.current);
    bottomTimer.current = null;
  }, []);

  const clearViewfinderTimer = useCallback(() => {
    if (!viewfinderTimer.current) return;
    clearTimeout(viewfinderTimer.current);
    viewfinderTimer.current = null;
  }, []);

  const interruptAction = useCallback(() => {
    clearPhaseTimer();
    clearAutoTimer();
    clearHoverTimer();
    clearBottomTimer();
    setAction('idle');
  }, [clearAutoTimer, clearBottomTimer, clearHoverTimer, clearPhaseTimer]);

  useEffect(() => {
    positionRef.current = positionX;
  }, [positionX]);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

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
    const onViewfinder = (event: Event) => {
      const { active } = (event as CustomEvent<PetViewfinderEventDetail>).detail;
      clearViewfinderTimer();

      if (active && !isHidden && !reduceMotion) {
        const trigger = document.querySelector<HTMLElement>('.site-viewfinder-trigger');
        const bounds = trigger?.getBoundingClientRect();
        const shellWidth = shellRef.current?.offsetWidth ?? 119;
        if (bounds) {
          // 双手挂住取景框下边框，从签名右侧向下探出。
          setViewfinderX(clamp(bounds.right - shellWidth * 0.66, 0, window.innerWidth - shellWidth));
          setViewfinderY(Math.max(0, bounds.bottom - 11));
        }

        interruptAction();
        setBubbleVisible(false);
        setViewfinderMode('departing');
        viewfinderTimer.current = setTimeout(() => {
          setViewfinderMode('peek');
          viewfinderTimer.current = null;
        }, 300);
        return;
      }

      setViewfinderMode((current) => current === 'none' ? 'none' : 'returning');
      viewfinderTimer.current = setTimeout(() => {
        setViewfinderMode('none');
        viewfinderTimer.current = null;
      }, 180);
    };

    window.addEventListener(PET_VIEWFINDER_EVENT, onViewfinder);
    return () => window.removeEventListener(PET_VIEWFINDER_EVENT, onViewfinder);
  }, [clearViewfinderTimer, interruptAction, isHidden, reduceMotion]);

  useEffect(() => {
    clearPhaseTimer();

    const advance = (nextAction: PetAction, delay: number) => {
      phaseTimer.current = setTimeout(() => {
        setAction(nextAction);
        phaseTimer.current = null;
      }, delay);
    };

    if (action === 'sitting') advance('guitar-ready', 900);
    else if (action === 'guitar-ready') advance('guitar-playing', 720);
    else if (action === 'guitar-playing') advance('guitar-rest', 6000 + Math.random() * 4000);
    else if (action === 'guitar-rest') advance('idle', 760);
    else if (action === 'waving') advance('idle', 1550);
    else if (action === 'startled') advance('idle', 1100);
    else if (action === 'stretching') advance('idle', 1850);
    else if (action === 'yawning') advance('idle', 1900);

    return clearPhaseTimer;
  }, [action, clearPhaseTimer]);

  useEffect(() => {
    clearAutoTimer();
    if (!entered || isHidden || reduceMotion || isHovered || action !== 'idle' || viewfinderMode !== 'none') return;

    const randomDelay = 45000 + Math.random() * 30000;
    const cooldownRemaining = Math.max(0, lastIdleActionAt.current + 90000 - Date.now());
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null;
      lastIdleActionAt.current = Date.now();
      setAction(Math.random() < 0.5 ? 'stretching' : 'yawning');
    }, Math.max(randomDelay, cooldownRemaining));

    return clearAutoTimer;
  }, [action, activitySignal, clearAutoTimer, entered, isHidden, isHovered, pathname, reduceMotion, viewfinderMode]);

  useEffect(() => {
    const markActivity = () => {
      const now = Date.now();
      if (now - activityThrottleAt.current < 250) return;
      activityThrottleAt.current = now;
      if (actionRef.current === 'stretching' || actionRef.current === 'yawning') {
        clearPhaseTimer();
        setAction('idle');
      }
      setActivitySignal((current) => current + 1);
    };

    window.addEventListener('scroll', markActivity, { passive: true });
    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    window.addEventListener('touchstart', markActivity, { passive: true });
    return () => {
      window.removeEventListener('scroll', markActivity);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('touchstart', markActivity);
    };
  }, [clearPhaseTimer]);

  useEffect(() => {
    clearBottomTimer();
    if (!entered || isHidden || viewfinderMode !== 'none') return;

    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingUp = currentScrollY < lastScrollY.current - 2;
      lastScrollY.current = currentScrollY;

      if (scrollingUp) {
        clearBottomTimer();
        if (actionRef.current === 'resting') setAction('idle');
        return;
      }

      const documentHeight = document.documentElement.scrollHeight;
      const atBottom = window.innerHeight + currentScrollY >= documentHeight - 16;
      if (!atBottom || actionRef.current !== 'idle' || dragRef.current) {
        clearBottomTimer();
        return;
      }

      if (bottomTimer.current) return;
      bottomTimer.current = setTimeout(() => {
        bottomTimer.current = null;
        const stillAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 16;
        if (stillAtBottom && actionRef.current === 'idle' && !dragRef.current) setAction('resting');
      }, 1500);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearBottomTimer();
    };
  }, [action, clearBottomTimer, entered, isHidden, viewfinderMode]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPositionX((current) => clampPosition(current));
    });
    return () => cancelAnimationFrame(frame);
  }, [clampPosition, viewportWidth]);

  useEffect(() => {
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      clearPhaseTimer();
      clearAutoTimer();
      clearHoverTimer();
      clearBottomTimer();
      clearViewfinderTimer();
    };
  }, [clearAutoTimer, clearBottomTimer, clearHoverTimer, clearPhaseTimer, clearViewfinderTimer]);

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
    interruptAction();
    const clickNumber = bumpVisitCount();
    if (clickNumber === 1) showBubble(GREETING_FIRST);
    else if (clickNumber === 2) showBubble(GREETING_SECOND);
    else showBubble(getRandomLyric());
    setAction('sitting');
  }, [bumpVisitCount, getRandomLyric, interruptAction, showBubble]);

  const freezeAtRenderedPosition = useCallback(() => {
    const renderedLeft = moverRef.current?.getBoundingClientRect().left;
    if (renderedLeft === undefined) return positionRef.current;
    const frozenPosition = clampPosition(renderedLeft);
    setPositionX(frozenPosition);
    positionRef.current = frozenPosition;
    return frozenPosition;
  }, [clampPosition]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || viewfinderMode !== 'none' || (event.target as HTMLElement).closest('[data-close-btn]')) return;
    interruptAction();
    const startX = freezeAtRenderedPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startX,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setLookX(0);
    setLookRotation(0);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const delta = event.clientX - drag.startClientX;
      if (Math.abs(delta) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (actionRef.current !== 'dragging') setAction('dragging');
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

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    setIsHovered(true);
    clearHoverTimer();
    hoverStartedAt.current = performance.now();
    hoverCanTrigger.current = false;
    wavePlayedForHover.current = false;

    if (event.pointerType !== 'mouse' || reduceMotion || actionRef.current !== 'idle' || viewfinderMode !== 'none') return;
    hoverCanTrigger.current = true;
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      if (actionRef.current !== 'idle' || dragRef.current || viewfinderMode !== 'none') return;
      wavePlayedForHover.current = true;
      clearAutoTimer();
      setAction('waving');
    }, 1000);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    clearHoverTimer();
    setIsHovered(false);
    setLookX(0);
    setLookRotation(0);

    const hoverDuration = performance.now() - hoverStartedAt.current;
    const shouldStartle = event.pointerType === 'mouse'
      && !reduceMotion
      && hoverDuration > 0
      && hoverDuration <= 300
      && hoverCanTrigger.current
      && !wavePlayedForHover.current
      && !dragRef.current
      && actionRef.current === 'idle'
      && Date.now() >= startleCooldownUntil.current;
    hoverCanTrigger.current = false;
    if (!shouldStartle) return;

    startleCooldownUntil.current = Date.now() + 20000;
    clearAutoTimer();
    setAction('startled');
  };

  const effectiveAction = action;
  const showClose = isHovered || effectiveAction === 'dragging';
  const visualState = viewfinderMode === 'peek'
    ? 'viewfinder'
    : effectiveAction === 'idle' && isHovered
      ? 'curious'
      : effectiveAction;
  const bubbleOnLeft = viewportWidth > 0 && positionX > viewportWidth * 0.58;
  const compactPet = viewportWidth > 0 && viewportWidth < 480;
  const isViewfinderPosition = viewfinderMode === 'peek' || viewfinderMode === 'returning';
  const isTransitioningPosition = viewfinderMode === 'departing' || viewfinderMode === 'returning';
  const baseWidth = compactPet ? 120 : 170;
  const baseHeight = compactPet ? 170 : 240;
  const petDimensions = {
    '--pet-width': `${baseWidth * FIXED_SCALE}px`,
    '--pet-height': `${baseHeight * FIXED_SCALE}px`,
  } as CSSProperties;
  const usesSprite = visualState === 'dragging'
    || visualState === 'resting'
    || visualState === 'sitting'
    || visualState === 'guitar-ready'
    || visualState === 'guitar-playing'
    || visualState === 'guitar-rest'
    || visualState === 'waving'
    || visualState === 'startled'
    || visualState === 'stretching'
    || visualState === 'yawning'
    || visualState === 'viewfinder';
  const spriteState = visualState === 'dragging'
    ? 'walking'
    : visualState === 'resting'
      ? 'sitting'
      : visualState;

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
        className={`pet-mover fixed left-0 z-50 select-none ${isViewfinderPosition ? 'pet-mover--viewfinder' : ''}`}
        style={{
          ...petDimensions,
          top: isViewfinderPosition ? viewfinderY : 'auto',
          bottom: isViewfinderPosition ? 'auto' : 0,
          transform: `translate3d(${isViewfinderPosition ? viewfinderX : positionX}px, 0, 0)`,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={shellRef}
          className={`pet-shell pet-shell--${visualState}`}
          style={{
            opacity: isHidden || !entered || isTransitioningPosition ? 0 : 1,
            pointerEvents: isHidden || viewfinderMode !== 'none' ? 'none' : 'auto',
            transform: isHidden
              ? 'translateY(28px) scale(0.72)'
              : isTransitioningPosition
                ? viewfinderMode === 'departing'
                  ? 'translateY(16px) scale(0.84)'
                  : 'translateY(-18px) scale(0.88)'
                : entered
                  ? 'translateY(0) scale(1)'
                  : 'translateY(100%) scale(0.92)',
          }}
          role="button"
          tabIndex={isHidden || viewfinderMode !== 'none' ? -1 : 0}
          aria-label="阿岳。点击看他弹吉他，拖动可以移动位置"
          title="点击阿岳看他弹吉他，或拖动他换个位置"
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointerInteraction(event)}
          onPointerCancel={(event) => finishPointerInteraction(event, true)}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <div
            className={`pet-bubble pet-bubble--${bubbleOnLeft ? 'left' : 'right'}`}
            data-visible={bubbleVisible && viewfinderMode === 'none'}
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
              interruptAction();
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
              <div className="pet-facing" style={{ transform: visualState === 'viewfinder' ? 'none' : `scaleX(${facing})` }}>
                {usesSprite ? (
                  <span className={`pet-sprite pet-sprite--${spriteState}`} aria-hidden />
                ) : (
                  <Image
                    src="/pet-ayue.png"
                    alt="阿岳"
                    width={170}
                    height={240}
                    className="h-full w-full object-contain pointer-events-none"
                    draggable={false}
                    priority
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
