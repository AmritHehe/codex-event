"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { rand, usePinProgress } from "./client";

const BARS = Array.from({ length: 36 }, (_, i) => ({ h: (25 + rand(i) * 75).toFixed(1), d: (rand(i + 50) * 0.9).toFixed(2), s: (0.7 + rand(i + 90) * 0.6).toFixed(2) }));

/** Scroll turns the volume up: "Loud." grows and the meter behind it rises. */
export function Loud() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinProgress(ref);
  const scale = useTransform(p, [0.05, 0.6], [0.45, 1]);
  const meter = useTransform(p, [0.05, 0.6], [0.08, 1]);
  const cta = useTransform(p, [0.6, 0.75], [0, 1]);
  const ctaY = useTransform(cta, [0, 1], [16, 0]);

  return (
    <section ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-10 overflow-hidden px-4">
        <motion.div aria-hidden style={{ scaleY: meter }} className="absolute inset-x-0 bottom-0 flex h-[55%] origin-bottom items-end justify-center gap-[0.8%] px-4">
          {BARS.map((b, i) => (
            <span
              key={i}
              className="eq w-[1.6%] rounded-t-full bg-accent/15"
              style={{ height: `${b.h}%`, animationDelay: `${b.d}s`, animationDuration: `${b.s}s` }}
            />
          ))}
        </motion.div>
        <h2 className="relative text-center font-display leading-[0.85] font-bold tracking-[-0.05em]">
          <span className="block text-[clamp(44px,8vw,120px)]">Ship it.</span>
          <motion.span style={{ scale }} className="block origin-top text-[clamp(96px,22vw,340px)] text-accent">
            Loud.
          </motion.span>
        </h2>
        <motion.div style={{ opacity: cta, y: ctaY }} className="relative flex flex-col items-center gap-4">
          <p className="max-w-[36ch] text-center text-[17px] text-muted">Start from the sample launch video. Everything you change is saved in your browser.</p>
          <Link href="/studio" className="press group inline-flex h-12 items-center gap-2 rounded-full bg-ink pr-2 pl-6 text-[15px] font-medium text-white">
            Open Studio
            <span className="grid size-8 place-items-center rounded-full bg-white/15 transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5">
              <ArrowRightIcon size={15} weight="bold" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
