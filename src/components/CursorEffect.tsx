'use client';

/**
 * 自定义鼠标光标：framer Motion 弹簧物理 + 彩色速度变色 + 弹簧链拖尾
 * - 主环：高刚度弹簧跟随鼠标（丝滑跟手）
 * - 拖尾弹簧链 5 个点，刚度逐级递减（越后越滞后），方向天然正确
 * - 颜色按速度 HSL 色相插值（慢 170↔快 320）
 * - 仅 pointer:fine 设备启用
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type Ripple = { id: number; x: number; y: number; hue: number };

const INTERACTIVE = 'a, button, .glass-btn, .glass, [role="button"], input[type="checkbox"], summary';
const HUE_SLOW = 170;
const HUE_FAST = 320;

export default function CursorEffect() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [hue, setHue] = useState(HUE_SLOW);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // ── 弹簧链（全部顶层 hook 调用） ──
  // 拖尾 0：直接跟随鼠标
  const t0x = useSpring(mouseX, { stiffness: 300, damping: 28, mass: 0.8 });
  const t0y = useSpring(mouseY, { stiffness: 300, damping: 28, mass: 0.8 });
  // 拖尾 1：跟随 t0
  const t1x = useSpring(t0x, { stiffness: 250, damping: 26, mass: 0.8 });
  const t1y = useSpring(t0y, { stiffness: 250, damping: 26, mass: 0.8 });
  // 拖尾 2：跟随 t1
  const t2x = useSpring(t1x, { stiffness: 200, damping: 24, mass: 0.8 });
  const t2y = useSpring(t1y, { stiffness: 200, damping: 24, mass: 0.8 });
  // 拖尾 3：跟随 t2
  const t3x = useSpring(t2x, { stiffness: 160, damping: 22, mass: 0.8 });
  const t3y = useSpring(t2y, { stiffness: 160, damping: 22, mass: 0.8 });
  // 拖尾 4：跟随 t3
  const t4x = useSpring(t3x, { stiffness: 130, damping: 20, mass: 0.8 });
  const t4y = useSpring(t3y, { stiffness: 130, damping: 20, mass: 0.8 });

  const trailChain = [
    { x: t0x, y: t0y, size: 14, alpha: 0.42 },
    { x: t1x, y: t1y, size: 12, alpha: 0.32 },
    { x: t2x, y: t2y, size: 10, alpha: 0.24 },
    { x: t3x, y: t3y, size: 8, alpha: 0.18 },
    { x: t4x, y: t4y, size: 6, alpha: 0.12 },
  ];

  // 主环：高刚度弹簧
  const ringX = useSpring(mouseX, { stiffness: 550, damping: 35, mass: 0.35 });
  const ringY = useSpring(mouseY, { stiffness: 550, damping: 35, mass: 0.35 });

  const hoverTarget = useRef<HTMLElement | null>(null);
  const lastPos = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    const u = () => setEnabled(mq.matches);
    u();
    mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    lastPos.current = { x: window.innerWidth / 2, y: window.innerHeight / 2, t: performance.now() };

    const onMove = (e: PointerEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      const now = performance.now();
      const dt = Math.max(1, now - lastPos.current.t);
      const speed = Math.sqrt(
        (e.clientX - lastPos.current.x) ** 2 + (e.clientY - lastPos.current.y) ** 2
      ) / dt;
      setHue((p) => p + (HUE_SLOW + (HUE_FAST - HUE_SLOW) * Math.min(1, speed / 2.4) - p) * 0.2);
      lastPos.current = { x: e.clientX, y: e.clientY, t: now };
    };
    const onOver = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest<HTMLElement>(INTERACTIVE);
      hoverTarget.current = el;
      setHovering(!!el);
    };
    const onDown = (e: PointerEvent) => {
      const id = e.timeStamp + Math.random();
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY, hue }]);
      setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [enabled, mouseX, mouseY]);

  if (!enabled) return null;
  const c = (a: number) => `hsl(${hue} 90% 65% / ${a})`;

  return (
    <div className="cursor-layer" aria-hidden>
      {trailChain.map((pt, i) => (
        <motion.div
          key={i}
          className="cursor-trail"
          style={{
            x: pt.x,
            y: pt.y,
            width: pt.size,
            height: pt.size,
            background: c(pt.alpha),
            translate: '-50% -50%',
          }}
        />
      ))}
      <motion.div
        className="cursor-glow"
        style={{
          x: mouseX,
          y: mouseY,
          background: `radial-gradient(circle, ${c(0.25)} 0%, ${c(0.05)} 50%, transparent 72%)`,
          translate: '-50% -50%',
        }}
      />
      <motion.div
        animate={hovering ? { scale: 1.7, borderWidth: 2.5 } : { scale: 1, borderWidth: 1.5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.5 }}
        className="cursor-ring"
        style={{
          x: ringX,
          y: ringY,
          borderColor: c(0.85),
          boxShadow: `0 0 12px ${c(0.4)}`,
          translate: '-50% -50%',
        }}
      />
      {ripples.map((r) => (
        <span
          key={r.id}
          className="cursor-ripple"
          style={{
            left: r.x,
            top: r.y,
            borderColor: `hsl(${r.hue} 90% 65% / 0.6)`,
            translate: '-50% -50%',
          }}
        />
      ))}
    </div>
  );
}
