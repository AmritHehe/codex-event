"use client";

import { AnimatePresence, motion, transform, useMotionValueEvent } from "motion/react";
import { useRef, useState } from "react";
import { THEME_PRESETS } from "@/video/themes";
import { EASE, ReflowStage, usePinProgress } from "./client";

const STOPS = [
  { at: 0, label: "16:9", where: "X, YouTube and LinkedIn video" },
  { at: 0.3, label: "1:1", where: "Instagram and LinkedIn feeds" },
  { at: 0.6, label: "9:16", where: "TikTok, Reels and Shorts" },
  { at: 0.84, label: "Any look", where: "Swap the theme, keep every edit" },
];

const KEYS = [0.06, 0.32, 0.56, 0.8];
const snap = (v: number) => Math.round(v / 24) * 24; // fewer re-renders, still smooth to the eye

export function Reflow() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinProgress(ref);
  const [s, setS] = useState({ w: 1920, h: 1080, theme: 0, stop: 0 });

  useMotionValueEvent(p, "change", (v) => {
    const w = snap(transform(v, KEYS, [1920, 1080, 1080, 1080]));
    const h = snap(transform(v, KEYS, [1080, 1080, 1080, 1920]));
    const theme = v < 0.86 ? 0 : Math.min(THEME_PRESETS.length - 1, 1 + Math.floor((v - 0.86) / 0.035));
    const stop = STOPS.findLastIndex((x) => v >= x.at);
    setS((o) => (o.w === w && o.h === h && o.theme === theme && o.stop === stop ? o : { w, h, theme, stop }));
  });

  const stop = STOPS[s.stop];
  return (
    <section ref={ref} className="relative h-[420vh]">
      <div className="sticky top-0 mx-auto grid h-dvh max-w-[1320px] grid-rows-[auto_minmax(0,1fr)] gap-6 px-4 pt-24 pb-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-1 md:gap-12 md:px-8 md:py-24">
        <div className="flex flex-col justify-center gap-5 md:gap-8">
          <h2 className="font-display text-[clamp(36px,4.8vw,72px)] leading-[0.95] font-bold tracking-[-0.04em]">
            It reflows like a&nbsp;web&nbsp;page.
          </h2>
          <p className="max-w-[38ch] text-[17px] leading-relaxed text-muted max-md:hidden">
            Your launch video is built from layers, not pixels. Change the format and the layout rebuilds itself. Nothing is re-rendered by hand.
          </p>
          <div className="relative h-[72px] md:h-[104px]">
            <AnimatePresence initial={false}>
              <motion.div
                key={stop.label}
                className="absolute inset-0"
                initial={{ opacity: 0, filter: "blur(8px)", transform: "translateY(14px)" }}
                animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)", transform: "translateY(-14px)", transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <p className="font-display text-[44px] leading-none font-bold tracking-[-0.03em] text-accent md:text-[64px]">{stop.label}</p>
                <p className="mt-2 text-[15px] text-muted">{stop.where}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {STOPS.map((x, i) => (
              <span key={x.label} className={`h-1 rounded-full transition-all duration-300 ${i === s.stop ? "w-10 bg-ink" : "w-4 bg-ink/15"}`} />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col items-center justify-center gap-3">
          <div className="grid min-h-0 w-full flex-1 place-items-center [container-type:size]">
            <div
              className="overflow-hidden rounded-[20px] bg-white shadow-[0_40px_80px_-32px_rgb(24_24_27/0.35),0_0_0_1px_rgb(24_24_27/0.06)]"
              style={{ aspectRatio: `${s.w} / ${s.h}`, width: `min(100cqw, 100cqh * ${s.w / s.h})` }}
            >
              <ReflowStage w={s.w} h={s.h} theme={s.theme} />
            </div>
          </div>
          <p className="font-mono text-[12px] text-muted tabular-nums">
            {s.w} × {s.h} · {THEME_PRESETS[s.theme].name}
          </p>
        </div>
      </div>
    </section>
  );
}
