"use client";

import type { PlayerRef } from "@remotion/player";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { AGENT_CLIENTS, FREE_CREDITS } from "@/lib/agent-contracts";
import { sampleProject } from "@/video/sample";
import { FPS, projectDuration, sceneStarts, TRANSITION_FRAMES } from "@/video/schema";
import { EASE, HeroStage, LABEL, tc } from "./client";
import { UrlForm } from "./Form";

const TOTAL = projectDuration(sampleProject);
const AGENT_NAMES = new Intl.ListFormat("en", { type: "disjunction" }).format(AGENT_CLIENTS.map((c) => c.name));
const STARTS = sceneStarts(sampleProject);
const SEGMENTS = sampleProject.scenes.map((s, i) => ({ id: s.id, name: s.name, from: STARTS[i], to: STARTS[i + 1] ?? TOTAL }));

// Same initial state on server and client (no hydration mismatch); reduced motion just skips the tween.
const fadeUp = (delay: number, reduce: boolean | null) => ({
  initial: { opacity: 0, transform: "translateY(12px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: reduce ? { duration: 0 } : { duration: 0.9, delay, ease: EASE },
});

/** Program monitor: the real engine playing the sample project, with its own timecode and scene track. */
function Monitor() {
  const player = useRef<PlayerRef | null>(null);
  const tcOut = useRef<HTMLSpanElement>(null);
  const head = useRef<HTMLDivElement>(null);

  const attach = useCallback((p: PlayerRef | null) => {
    player.current = p;
    if (!p) return;
    const on = ({ detail }: { detail: { frame: number } }) => {
      if (tcOut.current) tcOut.current.textContent = tc(detail.frame);
      if (head.current) head.current.style.transform = `translateX(${(detail.frame / (TOTAL - 1)) * 100}%)`;
    };
    p.addEventListener("frameupdate", on);
    return () => p.removeEventListener("frameupdate", on);
  }, []);

  const seek = (i: number) => {
    player.current?.seekTo(SEGMENTS[i].from + (i > 0 ? TRANSITION_FRAMES : 0));
    player.current?.play();
  };

  return (
    <figure className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <figcaption className={`flex h-9 items-center justify-between gap-4 border-b border-line px-3 ${LABEL}`}>
        <span className="flex min-w-0 gap-3">
          <span className="text-accent">PGM</span>
          <span className="truncate">{sampleProject.name}</span>
        </span>
        <span className="flex gap-3 tabular-nums">
          <span className="max-sm:hidden">
            1920 × 1080 · {FPS} fps
          </span>
          <span ref={tcOut} className="text-ink">
            {tc(0)}
          </span>
        </span>
      </figcaption>
      <div className="aspect-video bg-canvas">
        <HeroStage playerRef={attach} />
      </div>
      <div className="relative flex h-9 border-t border-line">
        {SEGMENTS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => seek(i)}
            style={{ flexGrow: s.to - s.from }}
            className="basis-0 truncate border-l border-line px-2 text-left font-mono text-[10px] tracking-[0.08em] text-muted uppercase transition-colors first:border-l-0 hover:bg-hover hover:text-ink"
            aria-label={`Play scene ${i + 1}: ${s.name}`}
          >
            <span className="text-faint">{String(i + 1).padStart(2, "0")}</span> <span className="max-sm:hidden">{s.name}</span>
          </button>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-px left-0">
          <div ref={head} className="absolute inset-0">
            <span className="absolute inset-y-0 left-0 w-px bg-accent" />
          </div>
        </div>
      </div>
    </figure>
  );
}

export function Hero({ channels, agents }: { channels: number; agents: number }) {
  const reduce = useReducedMotion();
  const anim = (delay: number) => fadeUp(delay, reduce);

  return (
    <section id="hook" data-scene="Hook" className="px-4 pt-[76px] md:px-8 md:pt-[88px]">
      <div className="mx-auto max-w-[1376px]">
        <motion.div {...anim(0)} className={`flex justify-between gap-4 border-b border-line pb-3 ${LABEL}`}>
          <span className="max-sm:hidden">Launch videos and distribution</span>
          <span className="tabular-nums">
            {channels} channels · {agents} workflows
          </span>
        </motion.div>

        {/* A playhead scrubs across the headline and reveals it. */}
        <h1 className="relative mt-6 w-fit text-[clamp(52px,11.6vw,168px)] leading-[0.9] font-semibold tracking-[-0.058em] md:mt-8">
          <motion.span
            className="block pr-[0.04em] pb-[0.06em]"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={reduce ? { duration: 0 } : { duration: 1.3, delay: 0.15, ease: EASE }}
          >
            <span className="block text-muted">Building is solved.</span>
            <span className="block">Distribution isn&apos;t.</span>
          </motion.span>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-full"
            initial={{ transform: "translateX(0%)", opacity: 1 }}
            animate={{ transform: "translateX(100%)", opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { transform: { duration: 1.3, delay: 0.15, ease: EASE }, opacity: { duration: 0.3, delay: 1.35 } }
            }
          >
            <span className="absolute -inset-y-3 left-0 w-px bg-accent" />
            <span className="absolute -top-3 -left-[3px] h-[6px] w-[7px] bg-accent" />
          </motion.span>
        </h1>

        <div className="mt-10 grid gap-x-10 gap-y-12 pb-24 md:mt-12 md:grid-cols-12 md:pb-32">
          <motion.div {...anim(0.7)} className="flex flex-col gap-8 md:col-span-5 lg:col-span-4">
            <p className="max-w-[40ch] text-[17px] leading-[1.55] text-muted md:text-[18px]">
              Shipcast turns your product page into a launch video you can edit layer by layer, cut for every feed, with launch guidance for
              {channels} channels.
            </p>
            <div>
              <Link
                href="/connect"
                className="press group inline-flex h-12 items-center gap-2.5 rounded-[6px] bg-ink px-5 text-[16px] font-medium text-canvas hover:bg-ink/85"
              >
                Connect your agent
                <ArrowRightIcon size={16} weight="bold" className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-3 max-w-[40ch] text-[14px] leading-[1.5] text-muted">
                {AGENT_NAMES} builds the film on the plan you already pay for. You watch it land on the timeline.
              </p>
            </div>
            <div id="no-agent" className="scroll-mt-24 border-t border-line pt-6">
              <p className={`${LABEL} mb-4`}>
                No agent? <span className="text-ink">{FREE_CREDITS} free credits</span>
              </p>
              <UrlForm quiet />
            </div>
          </motion.div>
          <motion.div {...anim(0.85)} className="md:col-span-7 lg:col-span-8">
            <Monitor />
            <p className={`mt-3 flex justify-between gap-4 ${LABEL}`}>
              <span>Live engine, not a recording</span>
              <span className="tabular-nums">
                {SEGMENTS.length} scenes<span className="max-sm:hidden"> · {tc(TOTAL)}</span>
              </span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
