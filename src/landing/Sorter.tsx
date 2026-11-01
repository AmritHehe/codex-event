"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { AUTOMATION, CHANNELS, type Automation, type Channel } from "@/distribution/channels";
import { ChannelLogo } from "@/distribution/icons";
import { easeOutCubic, rand, usePinProgress, useSize } from "./client";

const GROUPS: { id: Automation; bg: string; fg: string }[] = [
  { id: "full", bg: "#e8501c", fg: "#ffffff" },
  { id: "assisted", bg: "#18181b", fg: "#ffffff" },
  { id: "manual", bg: "#e6e6e9", fg: "#6b6b74" },
];
const ORDERED = GROUPS.flatMap((g) => CHANNELS.filter((c) => c.automation === g.id));

function layout(w: number, h: number) {
  const cols = w < 520 ? 4 : 6;
  const gap = w < 520 ? 14 : 36;
  const step = Math.min(38, (w - gap * 2) / (cols * 3));
  const groupW = cols * step;
  const left = (w - (groupW * 3 + gap * 2)) / 2;
  const rows = Math.ceil(Math.max(...GROUPS.map((g) => CHANNELS.filter((c) => c.automation === g.id).length)) / cols);
  const top = Math.max(72, (h - rows * step) / 2 + 36); // centered, with room for the counts above
  return { cols, gap, step, groupW, left, top };
}

function Chip({ c, i, p, size }: { c: Channel; i: number; p: MotionValue<number>; size: { w: number; h: number } }) {
  const L = layout(size.w, size.h);
  const g = GROUPS.findIndex((x) => x.id === c.automation);
  const idx = ORDERED.filter((x) => x.automation === c.automation).indexOf(c);
  const tx = L.left + g * (L.groupW + L.gap) + (idx % L.cols) * L.step;
  const ty = L.top + Math.floor(idx / L.cols) * L.step;
  const sx = rand(i) * (size.w - L.step);
  const sy = rand(i + 101) * (size.h - L.step);

  const start = 0.12 + rand(i + 7) * 0.25;
  const t = useTransform(p, [start, start + 0.3], [0, 1], { ease: easeOutCubic });
  const x = useTransform(t, (v) => sx + (tx - sx) * v);
  const y = useTransform(t, (v) => sy + (ty - sy) * v);
  const rotate = useTransform(t, [0, 1], [(rand(i + 3) - 0.5) * 90, 0]);
  const backgroundColor = useTransform(t, [0.6, 1], ["#ffffff", GROUPS[g].bg]);
  const color = useTransform(t, [0.6, 1], ["#18181b", GROUPS[g].fg]);

  return (
    <motion.div
      title={c.name}
      style={{ x, y, rotate, backgroundColor, color, width: L.step - 6, height: L.step - 6 }}
      className="absolute top-0 left-0 grid place-items-center rounded-[9px] shadow-[0_4px_10px_-4px_rgb(24_24_27/0.25),0_0_0_1px_rgb(24_24_27/0.06)]"
    >
      <ChannelLogo c={c} size={Math.round(L.step * 0.42)} />
    </motion.div>
  );
}

export function Sorter() {
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const p = usePinProgress(ref);
  const size = useSize(stage);
  const L = layout(size.w, size.h);
  const labels = useTransform(p, [0.55, 0.7], [0, 1]);

  return (
    <section ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 mx-auto grid h-dvh max-w-[1320px] grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 pt-24 pb-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-1 md:gap-12 md:px-8 md:py-24">
        <div className="flex flex-col justify-center gap-5">
          <h2 className="font-display text-[clamp(34px,4.4vw,64px)] leading-[0.95] font-bold tracking-[-0.04em]">
            Posts itself where it&apos;s allowed. <span className="text-muted">Drafts where it isn&apos;t.</span>
          </h2>
          <p className="max-w-[40ch] text-[17px] leading-relaxed text-muted max-md:text-[15px]">
            Some communities ban automated or AI-written posts. Shipcast follows each channel&apos;s rules: official APIs where they exist, a ready draft everywhere else.
          </p>
        </div>
        <div ref={stage} className="relative min-h-0">
          {size.w > 0 && ORDERED.map((c, i) => <Chip key={c.id} c={c} i={i} p={p} size={size} />)}
          {size.w > 0 &&
            GROUPS.map((g, gi) => {
              const n = CHANNELS.filter((c) => c.automation === g.id).length;
              return (
                <motion.div
                  key={g.id}
                  style={{ opacity: labels, left: L.left + gi * (L.groupW + L.gap), top: L.top - 72, width: L.groupW }}
                  className="absolute"
                >
                  <p className="font-display text-[28px] leading-none font-bold tabular-nums md:text-[36px]" style={{ color: g.id === "manual" ? "#6b6b74" : g.bg }}>
                    {n}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-muted md:text-[13px]">{AUTOMATION[g.id].label}</p>
                </motion.div>
              );
            })}
        </div>
      </div>
    </section>
  );
}
