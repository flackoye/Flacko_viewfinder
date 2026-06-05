"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}

/**
 * 滚动揭示包装组件
 * 子元素进入视口时触发淡入 + 滑动动画
 */
export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  const directionClass =
    direction === "left"
      ? "scroll-left"
      : direction === "right"
        ? "scroll-right"
        : "";

  return (
    <div
      ref={ref}
      className={`${className} ${revealed ? "scroll-revealed" : `scroll-hidden ${directionClass}`}`}
      style={{ transitionDelay: revealed ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
