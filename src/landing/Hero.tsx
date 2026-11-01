"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { GenerateForm } from "@/components/GenerateForm";
import { EASE, HeroStage } from "./client";

function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        initial={reduce ? false : { transform: "translateY(105%)" }}
        animate={{ transform: "translateY(0%)" }}
        transition={{ duration: 1, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** A marker swipes across the word, then the word flips to white on top of it. */
function Marker({ children }: { children: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative isolate inline-block px-[0.06em]">
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-[0.14em] bottom-[0.02em] -z-10 origin-left rounded-[0.14em] bg-accent"
        initial={reduce ? false : { transform: "scaleX(0)" }}
        animate={{ transform: "scaleX(1)" }}
        transition={{ duration: 0.75, delay: 0.95, ease: [0.77, 0, 0.175, 1] }}
      />
      <motion.span initial={reduce ? false : { color: "#18181b" }} animate={{ color: "#ffffff" }} transition={{ duration: 0.2, delay: 1.25 }}>
        {children}
      </motion.span>
    </span>
  );
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, transform: "translateY(12px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: 0.8, delay, ease: EASE },
});

export function Hero({ channels }: { channels: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // The stage lies back like a screen on a desk and stands up as you scroll into it.
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.86, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [36, 20]);

  return (
    <section className="px-4 pt-32 md:px-8 md:pt-40">
      <div className="mx-auto max-w-[1320px]">
        <h1 className="font-display text-[clamp(44px,8.2vw,124px)] leading-[0.94] font-bold tracking-[-0.045em]">
          <Line delay={0.05}>Building is solved.</Line>
          <Line delay={0.17}>
            <Marker>Distribution</Marker> isn&apos;t.
          </Line>
        </h1>
        <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <motion.p {...(reduce ? {} : fadeUp(0.55))} className="max-w-[40ch] text-[18px] leading-relaxed text-muted">
            Shipcast turns your product into launch videos, threads and memes, then gets them in front of people on {channels} channels.
          </motion.p>
          <motion.div {...(reduce ? {} : fadeUp(0.65))} className="flex shrink-0 gap-3">
            <Link href="/studio" className="press group inline-flex h-12 items-center gap-2 rounded-full bg-ink pr-2 pl-6 text-[15px] font-medium text-white">
              Open Studio
              <span className="grid size-8 place-items-center rounded-full bg-white/15 transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5">
                <ArrowRightIcon size={15} weight="bold" />
              </span>
            </Link>
            <Link href="/distribution" className="press inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium ring-1 ring-ink/15 hover:bg-white">
              See the channels
            </Link>
          </motion.div>
        </div>
        <GenerateForm />
      </div>

      <div ref={stage} className="mx-auto mt-16 max-w-[1320px] [perspective:1600px]">
        <motion.div
          {...(reduce ? {} : fadeUp(0.8))}
          style={{ rotateX, scale, borderRadius: radius, transformOrigin: "50% 100%" }}
          className="aspect-video overflow-hidden bg-white shadow-[0_60px_120px_-40px_rgb(232_80_28/0.35),0_30px_60px_-30px_rgb(24_24_27/0.3),0_0_0_1px_rgb(24_24_27/0.06)] will-change-transform"
        >
          <HeroStage />
        </motion.div>
      </div>
    </section>
  );
}
