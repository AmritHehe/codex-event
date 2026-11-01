"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { CHANNELS, type Channel } from "@/distribution/channels";
import { ChannelLogo } from "@/distribution/icons";
import { CardThumb, easeOutCubic, rand, usePinProgress, useSize } from "./client";

const PICK = [
  "tiktok", "instagram", "youtube-shorts", "x", "linkedin-personal", "threads", "bluesky", "reddit", "product-hunt", "hacker-news",
  "discord", "github", "mcp-registry", "chatgpt-apps", "claude-plugins", "newsletter", "telegram", "pinterest", "mastodon", "devto",
  "chrome-web-store", "cold-email", "ai-directories", "slack-communities",
];
const TILES = PICK.map((id) => CHANNELS.find((c) => c.id === id)!).filter(Boolean);
const INNER = 9;

function Tile({ c, i, p, size }: { c: Channel; i: number; p: MotionValue<number>; size: { w: number; h: number } }) {
  const inner = i < INNER;
  const n = inner ? INNER : TILES.length - INNER;
  const k = inner ? i : i - INNER;
  const angle = (k / n) * Math.PI * 2 + (inner ? 0.35 : 0) - Math.PI / 2;
  const rx = size.w * (inner ? 0.24 : 0.43);
  const ry = size.h * (inner ? 0.25 : 0.4);
  const fx = Math.cos(angle) * rx;
  const fy = Math.sin(angle) * ry;

  const start = 0.08 + rand(i) * 0.18;
  const t = useTransform(p, [start, start + 0.3], [0, 1], { ease: easeOutCubic });
  const x = useTransform(t, (v) => fx * v);
  const y = useTransform(t, (v) => fy * v);
  const scale = useTransform(t, [0, 1], [0.2, 1]);
  const rotate = useTransform(t, [0, 1], [(rand(i + 9) - 0.5) * 120, (rand(i + 3) - 0.5) * 14]);
  const opacity = useTransform(t, [0, 0.15], [0, 1]);

  return (
    <motion.div
      style={{ x, y, scale, rotate, opacity }}
      className="absolute top-1/2 left-1/2 -mt-7 -ml-7 grid size-14 place-items-center rounded-2xl bg-white shadow-[0_10px_24px_-10px_rgb(24_24_27/0.3),0_0_0_1px_rgb(24_24_27/0.06)] md:-mt-8 md:-ml-8 md:size-16"
      title={c.name}
    >
      <ChannelLogo c={c} size={24} />
    </motion.div>
  );
}

export function FanOut({ total, agents }: { total: number; agents: number }) {
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const p = usePinProgress(ref);
  const size = useSize(stage);

  const cardScale = useTransform(p, [0, 0.12, 0.5], [1.15, 1, 0.82]);
  const ring = useTransform(p, [0.05, 0.45], [0, 1]);
  const ringScale = useTransform(ring, [0, 1], [0.3, 1]);
  const ringOpacity = useTransform(ring, [0, 0.3, 1], [0, 1, 1]);
  const outro = useTransform(p, [0.55, 0.7], [0, 1]);
  const outroY = useTransform(outro, [0, 1], [16, 0]);

  return (
    <section ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-dvh flex-col overflow-hidden px-4 pt-24 pb-8 md:px-8">
        <h2 className="mx-auto max-w-[18ch] text-center font-display text-[clamp(34px,4.6vw,68px)] leading-[0.95] font-bold tracking-[-0.04em]">
          One video. {total} places to&nbsp;be.
        </h2>
        <div ref={stage} className="relative mx-auto w-full max-w-[1100px] flex-1">
          <motion.div
            aria-hidden
            style={{ scale: ringScale, opacity: ringOpacity }}
            className="absolute inset-[6%_8%] rounded-[50%] border border-dashed border-ink/10"
          />
          <motion.div
            aria-hidden
            style={{ scale: ringScale, opacity: ringOpacity }}
            className="absolute inset-[24%_27%] rounded-[50%] border border-dashed border-accent/30"
          />
          {/* Positions depend on the measured stage, so tiles mount client-side only. */}
          {size.w > 0 && TILES.map((c, i) => <Tile key={c.id} c={c} i={i} p={p} size={size} />)}
          <motion.div
            style={{ scale: cardScale }}
            className="absolute top-1/2 left-1/2 aspect-video w-[min(300px,46vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-24px_rgb(232_80_28/0.45),0_0_0_1px_rgb(24_24_27/0.06)]"
          >
            <CardThumb />
          </motion.div>
        </div>
        <motion.div style={{ opacity: outro, y: outroY }} className="mx-auto flex max-w-[56ch] flex-col items-center gap-3 text-center">
          <p className="text-[17px] leading-relaxed text-muted">
            {agents} agents prepare a version for each one: cut to the right format, written for that audience, posted where the rules allow.
          </p>
          <Link href="/distribution" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
            See the channels
            <ArrowRightIcon size={15} weight="bold" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
