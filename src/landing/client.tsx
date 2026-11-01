"use client";

import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";

// Remotion renders client-only; skeletons reserve the same space so nothing shifts on load.
const skeleton = (cls: string) =>
  function Skeleton() {
    return <div className={`animate-pulse rounded-2xl bg-line/60 ${cls}`} />;
  };

export const HeroPlayer = dynamic(() => import("./Live").then((m) => m.HeroPlayer), {
  ssr: false,
  loading: skeleton("h-[min(500px,50vh,calc((100vw-32px)/1.778))] w-full"),
});
export const AspectStrip = dynamic(() => import("./Live").then((m) => m.AspectStrip), { ssr: false, loading: skeleton("h-48 w-full") });
export const ThemeGrid = dynamic(() => import("./Live").then((m) => m.ThemeGrid), { ssr: false, loading: skeleton("aspect-video w-full") });
export const CtaThumb = dynamic(() => import("./Live").then((m) => m.CtaThumb), { ssr: false, loading: skeleton("aspect-video w-full") });

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, transform: "translateY(16px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
