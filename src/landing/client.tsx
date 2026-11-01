"use client";

import { useMotionValue, useReducedMotion, useScroll, type MotionValue } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState, type RefObject } from "react";

// Remotion renders client-only; the parent box reserves space, so nothing shifts when it mounts.
const blank = () => <div className="h-full w-full animate-pulse bg-line/50" />;
export const HeroStage = dynamic(() => import("./Live").then((m) => m.HeroStage), { ssr: false, loading: blank });
export const ReflowStage = dynamic(() => import("./Live").then((m) => m.ReflowStage), { ssr: false, loading: blank });
export const CardThumb = dynamic(() => import("./Live").then((m) => m.CardThumb), { ssr: false, loading: blank });

export const EASE = [0.16, 1, 0.3, 1] as const;
export const easeOutCubic = (v: number) => 1 - Math.pow(1 - v, 3);

/** Scroll progress through a pinned section; reduced motion jumps straight to the end state. */
export function usePinProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const done = useMotionValue(1);
  return useReducedMotion() ? done : scrollYProgress;
}

export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Deterministic 0..1 noise so scatter layouts match between renders. */
export const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
