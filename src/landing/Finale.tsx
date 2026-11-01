"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { EASE, LABEL, PAGE_FRAMES, tc } from "./client";
import { UrlForm } from "./Form";
import { Mark } from "./Hud";

function Line({ children, delay, className = "" }: { children: React.ReactNode; delay: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.04em]">
      <motion.span
        className={`block ${className}`}
        initial={{ transform: "translateY(100%)" }}
        whileInView={{ transform: "translateY(0%)" }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={reduce ? { duration: 0 } : { duration: 1, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function Finale({ channels }: { channels: number }) {
  return (
    <section id="ship" data-scene="Ship" className="border-t border-line px-4 pt-24 md:px-8 md:pt-36">
      <div className="mx-auto max-w-[1376px]">
        <p className={`${LABEL} mb-6`}>05 Ship</p>
        <h2 className="text-[clamp(84px,20.5vw,330px)] leading-[0.8] font-semibold tracking-[-0.07em]">
          <Line delay={0}>Ship it</Line>
          <Line delay={0.1} className="text-accent md:text-right">
            loud.
          </Line>
        </h2>

        <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-12">
          <p className="max-w-[36ch] text-[17px] leading-[1.55] text-muted md:col-span-4 md:text-[18px]">
            Paste your URL. Get a launch video, cut for every feed, with a post drafted for each of {channels} channels.
          </p>
          <div className="md:col-span-6 md:col-start-7">
            <UrlForm />
          </div>
        </div>

        <footer className="mt-24 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line py-6 text-[14px] text-muted md:mt-36">
          <span className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-ink">
            <Mark />
            Shipcast
          </span>
          <Link href="/studio" className="transition-colors hover:text-ink">
            Studio
          </Link>
          <Link href="/distribution" className="transition-colors hover:text-ink">
            Channels
          </Link>
          <span className={`ml-auto tabular-nums ${LABEL}`}>End {tc(PAGE_FRAMES)}</span>
          <span>© 2026 Shipcast</span>
        </footer>
      </div>
    </section>
  );
}
