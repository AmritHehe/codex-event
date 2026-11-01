"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { AUTOMATION, CHANNELS, type Automation, type Channel } from "@/distribution/channels";
import { ChannelLogo } from "@/distribution/icons";
import { easeOutCubic, LABEL, rand, usePinProgress, useSize } from "./client";

// One track per automation level, like video tracks in an editor. Clip colors: one accent, ink, paper.
const GROUPS: { id: Automation; fill: string; fg: string }[] = [
  { id: "full", fill: "bg-accent", fg: "text-white" },
  { id: "assisted", fill: "bg-ink", fg: "text-canvas" },
  { id: "manual", fill: "bg-hover", fg: "text-ink" },
];
const ITEMS = GROUPS.map((g) => CHANNELS.filter((c) => c.automation === g.id));
const ORDERED = ITEMS.flat();

function layout(w: number, h: number) {
  const narrow = w < 640;
  const head = narrow ? 0 : 184; // track header column
  const cap = narrow ? 26 : 0; // header row above the lane on narrow screens
  const step = narrow ? 30 : 46;
  const pad = narrow ? 10 : 14;
  const cols = Math.max(1, Math.floor((w - head - pad * 2) / step));
  let y = 0;
  const tracks = ITEMS.map((items) => {
    const t = { top: y, h: Math.max(narrow ? 0 : 104, cap + pad * 2 + Math.ceil(items.length / cols) * step) };
    y += t.h;
    return t;
  });
  const oy = Math.max(0, (h - y) / 2);
  return { head, cap, step, pad, cols, tracks: tracks.map((t) => ({ ...t, top: t.top + oy })) };
}
type Layout = ReturnType<typeof layout>;

function Clip({ c, i, p, size, L }: { c: Channel; i: number; p: MotionValue<number>; size: { w: number; h: number }; L: Layout }) {
  const g = GROUPS.findIndex((x) => x.id === c.automation);
  const idx = ITEMS[g].indexOf(c);
  const tx = L.head + L.pad + (idx % L.cols) * L.step;
  const ty = L.tracks[g].top + L.cap + L.pad + Math.floor(idx / L.cols) * L.step;
  const sx = rand(i) * (size.w - L.step);
  const sy = rand(i + 101) * (size.h - L.step);

  const start = 0.1 + rand(i + 7) * 0.3;
  const t = useTransform(p, [start, start + 0.28], [0, 1], { ease: easeOutCubic });
  const x = useTransform(t, (v) => sx + (tx - sx) * v);
  const y = useTransform(t, (v) => sy + (ty - sy) * v);
  const rotate = useTransform(t, [0, 1], [(rand(i + 3) - 0.5) * 70, 0]);
  const fill = useTransform(t, [0.7, 1], [0, 1]);
  const s = L.step - 6;
  const icon = Math.round(L.step * 0.4);

  return (
    <motion.div title={c.name} style={{ x, y, rotate, width: s, height: s }} className="absolute top-0 left-0">
      <span className="absolute inset-0 grid place-items-center rounded-[6px] border border-line bg-panel text-ink">
        <ChannelLogo c={c} size={icon} />
      </span>
      <motion.span style={{ opacity: fill }} className={`absolute inset-0 grid place-items-center rounded-[6px] ${GROUPS[g].fill} ${GROUPS[g].fg}`}>
        <ChannelLogo c={c} size={icon} />
      </motion.span>
    </motion.div>
  );
}

export function Sorter() {
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const p = usePinProgress(ref);
  const size = useSize(stage);
  const L = layout(size.w, size.h);
  const counts = useTransform(p, [0.5, 0.65], [0, 1]);

  return (
    <section ref={ref} id="channels" data-scene="Channels" className="relative h-[320vh] border-t border-line motion-reduce:h-auto">
      <div className="sticky top-0 mx-auto flex h-dvh max-w-[1440px] flex-col gap-6 px-4 pt-[76px] pb-9 md:gap-10 md:px-8 md:pt-24 md:pb-16">
        <div className="grid gap-4 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7">
            <p className={`${LABEL} mb-4 max-md:hidden`}>03 Channels</p>
            <h2 className="text-[clamp(36px,5.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.055em]">
              One video. {CHANNELS.length}&nbsp;channels.
            </h2>
          </div>
          <div className="flex flex-col justify-end gap-3 md:col-span-5">
            <p className="text-[19px] leading-snug font-medium tracking-[-0.01em] md:text-[22px]">
              Posts itself where it&apos;s allowed. Drafts where it isn&apos;t.
            </p>
            <p className="max-w-[46ch] text-[15px] leading-[1.55] text-muted max-md:hidden md:text-[16px]">
              Some communities ban automated or AI-written posts. Shipcast follows each channel&apos;s rules: official APIs where they exist,
              a ready draft everywhere else.
            </p>
          </div>
        </div>

        <div ref={stage} className="relative min-h-0 flex-1">
          {size.w > 0 &&
            GROUPS.map((g, gi) => {
              const t = L.tracks[gi];
              return (
                <div
                  key={g.id}
                  style={{ top: t.top, height: t.h }}
                  className={`absolute inset-x-0 border-t border-line ${gi === GROUPS.length - 1 ? "border-b" : ""}`}
                >
                  <div
                    style={{ width: L.head || undefined, height: L.cap || undefined }}
                    className="absolute top-0 left-0 flex items-start gap-3 px-0 pt-2 md:h-full md:flex-col md:justify-between md:border-r md:border-line md:py-3 md:pr-4"
                  >
                    <span className={`${LABEL} text-faint`}>V{gi + 1}</span>
                    <motion.span style={{ opacity: counts }} className="flex items-baseline gap-2 md:flex-col md:gap-1">
                      <span className="text-[13px] font-medium md:text-[15px]">{AUTOMATION[g.id].label}</span>
                      <span className={`${LABEL} tabular-nums`}>
                        {ITEMS[gi].length} {ITEMS[gi].length === 1 ? "channel" : "channels"}
                      </span>
                    </motion.span>
                  </div>
                </div>
              );
            })}
          {/* Positions depend on the measured stage, so clips mount client-side only. */}
          <div aria-hidden>{size.w > 0 && ORDERED.map((c, i) => <Clip key={c.id} c={c} i={i} p={p} size={size} L={L} />)}</div>
        </div>
      </div>
    </section>
  );
}
