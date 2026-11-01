"use client";

import { useMotionValue, useReducedMotion, useScroll, type MotionValue } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState, type RefObject } from "react";
import { FPS } from "@/video/schema";

// Remotion renders client-only; the parent box reserves space, so nothing shifts when it mounts.
const blank = () => <div className="h-full w-full animate-pulse bg-line/50" />;
export const HeroStage = dynamic(() => import("./Live").then((m) => m.HeroStage), { ssr: false, loading: blank });
export const ReflowStage = dynamic(() => import("./Live").then((m) => m.ReflowStage), { ssr: false, loading: blank });

/** Frames to broadcast timecode, HH:MM:SS:FF. */
export function tc(frames: number) {
  const f = Math.max(0, Math.round(frames));
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${p(f / (FPS * 3600))}:${p((f / (FPS * 60)) % 60)}:${p((f / FPS) % 60)}:${p(f % FPS)}`;
}

/** The whole page is a 60 second timeline: the HUD maps scroll progress onto it. */
export const PAGE_FRAMES = 60 * FPS;

export const LABEL = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const easeOutCubic = (v: number) => 1 - Math.pow(1 - v, 3);

/** Scroll progress through a pinned section; reduced motion jumps straight to the end state. */
export function usePinProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  // Starts at 0 and is set after mount, so "change" subscribers (useMotionValueEvent) see the end state too.
  const done = useMotionValue(0);
  useEffect(() => {
    if (reduce) done.set(1);
  }, [reduce, done]);
  return reduce ? done : scrollYProgress;
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
