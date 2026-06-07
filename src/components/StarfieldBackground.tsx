'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/** 背景预设 — 4 种完全不同风格 */
export interface BgPreset {
  name: string;
  label: string;
  emoji: string;
}

export const BG_PRESETS: BgPreset[] = [
  { name: 'starfield', label: '星空', emoji: '✦' },
  { name: 'aurora', label: '极光', emoji: '♒' },
  { name: 'ripple', label: '涟漪', emoji: '◎' },
  { name: 'minimal', label: '素净', emoji: '◐' },
];

/** 简易伪随机数 */
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

interface Props {
  presetName?: string;
}

export default function BackgroundCanvas({ presetName = 'starfield' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const animRef = useRef<number>(0);
  const starsRef = useRef<Array<{ x: number; y: number; s: number; o: number; g: boolean }>>([]);

  // 尺寸
  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 生成星星
  const genStars = useCallback((w: number, h: number) => {
    const r = seededRandom(42);
    const stars: typeof starsRef.current = [];
    for (let i = 0; i < 250; i++) {
      stars.push({
        x: r() * w, y: r() * h,
        s: r() * 1.8 + 0.3,
        o: r() * 0.45 + 0.08,
        g: r() < 0.06,
      });
    }
    starsRef.current = stars;
  }, []);

  // 绘制
  useEffect(() => {
    if (!dims.w) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = dims;

    cancelAnimationFrame(animRef.current);

    if (presetName === 'minimal') {
      // 素净 — 纯渐变，无图案
      ctx.clearRect(0, 0, w, h);
      return;
    }

    if (presetName === 'starfield') {
      genStars(w, h);
      const drawStars = () => {
        ctx!.clearRect(0, 0, w, h);
        for (const st of starsRef.current) {
          ctx!.beginPath();
          ctx!.arc(st.x, st.y, st.s, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(190,210,240,${st.o})`;
          ctx!.fill();
          if (st.g) {
            ctx!.beginPath();
            ctx!.arc(st.x, st.y, st.s * 3, 0, Math.PI * 2);
            ctx!.fillStyle = `rgba(170,200,245,${st.o * 0.12})`;
            ctx!.fill();
          }
        }
      };
      drawStars();
      return;
    }

    // aurora & ripple — 动画
    let t = 0;
    const animate = () => {
      t += 0.003;
      ctx!.clearRect(0, 0, w, h);

      if (presetName === 'aurora') {
        // 极光 — 柔和的渐变色带缓慢流动
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.2 + i * 0.3 + Math.sin(t + i * 2) * 0.1);
          const cy = h * (0.3 + Math.cos(t * 0.7 + i) * 0.15);
          const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, w * 0.35);
          const hue = 220 + i * 40 + Math.sin(t + i) * 15;
          grad.addColorStop(0, `hsla(${hue}, 60%, 55%, 0.035)`);
          grad.addColorStop(0.5, `hsla(${hue + 20}, 50%, 50%, 0.015)`);
          grad.addColorStop(1, 'transparent');
          ctx!.fillStyle = grad;
          ctx!.fillRect(0, 0, w, h);
        }
      }

      if (presetName === 'ripple') {
        // 涟漪 — 同心圆缓慢扩散
        const cx = w * 0.5, cy = h * 0.45;
        for (let i = 0; i < 5; i++) {
          const r = ((t * 80 + i * 120) % (Math.max(w, h) * 0.8));
          ctx!.beginPath();
          ctx!.arc(cx, cy, r, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(91, 163, 245, ${Math.max(0, 0.06 - r * 0.00005)})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animRef.current);
  }, [dims, presetName, genStars]);

  return (
    <canvas
      ref={canvasRef}
      width={dims.w}
      height={dims.h}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
