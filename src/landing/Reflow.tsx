"use client";

import { AnimatePresence, motion, transform, useMotionValueEvent, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { FPS } from "@/video/schema";
import { THEME_PRESETS } from "@/video/themes";
import { EASE, LABEL, ReflowStage, usePinProgress } from "./client";

const STOPS = [
  { at: 0, label: "16:9", where: "X, YouTube and LinkedIn video" },
  { at: 0.3, label: "1:1", where: "Instagram and LinkedIn feeds" },
  { at: 0.6, label: "9:16", where: "TikTok, Reels and Shorts" },
  { at: 0.84, label: "Theme", where: "Swap the look, keep every edit" },
];

const KEYS = [0.06, 0.32, 0.56, 0.8];
const snap = (v: number) => Math.round(v / 24) * 24; // fewer re-renders, still smooth to the eye

/** Crop marks just outside each corner of the frame. */
function Corners() {
  const base = "absolute size-3 border-ink";
  return (
    <span aria-hidden>
      <span className={`${base} -top-2 -left-2 border-t border-l`} />
      <span className={`${base} -top-2 -right-2 border-t border-r`} />
      <span className={`${base} -bottom-2 -left-2 border-b border-l`} />
      <span className={`${base} -right-2 -bottom-2 border-r border-b`} />
    </span>
  );
}

export function Reflow() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinProgress(ref);
  const playX = useTransform(p, (v) => `${v * 100}%`);
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
    <section ref={ref} id="reflow" data-scene="Reflow" className="relative h-[420vh] border-t border-line motion-reduce:h-auto">
      <div className="sticky top-0 mx-auto grid h-dvh max-w-[1440px] grid-rows-[auto_minmax(0,1fr)] gap-6 px-4 pt-[76px] pb-9 md:grid-cols-12 md:grid-rows-1 md:gap-10 md:px-8 md:pt-24 md:pb-16">
        <div className="flex flex-col justify-center gap-5 md:col-span-5 md:gap-8">
          <div>
            <p className={`${LABEL} mb-4 max-md:hidden`}>02 Reflow</p>
            <h2 className="text-[clamp(36px,5.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.055em]">
              It reflows like a&nbsp;web&nbsp;page.
            </h2>
          </div>
          <p className="max-w-[40ch] text-[17px] leading-[1.55] text-muted max-md:hidden">
            Your launch video is built from layers, not pixels. Change the format and the layout rebuilds itself. Nothing is re-cut by hand.
          </p>

          <div className="max-md:flex max-md:items-end max-md:justify-between max-md:gap-4">
            <div className="relative h-[52px] overflow-hidden max-md:flex-1 md:h-[118px]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={stop.label}
                  className="absolute inset-0"
                  initial={{ opacity: 0, transform: "translateY(40%)" }}
                  animate={{ opacity: 1, transform: "translateY(0%)" }}
                  exit={{ opacity: 0, transform: "translateY(-40%)", transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <p className="text-[44px] leading-none font-semibold tracking-[-0.05em] tabular-nums md:text-[88px]">{stop.label}</p>
                  <p className="mt-2 text-[15px] text-muted max-md:hidden">{stop.where}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="pb-1 text-right text-[14px] text-muted md:hidden">{stop.where}</p>
          </div>

          {/* Section progress as a track: one segment per stop, an orange playhead at the scroll position. */}
          <div className="relative flex h-8 border-y border-line" aria-hidden>
            {STOPS.map((x, i) => (
              <span
                key={x.label}
                style={{ flexGrow: (STOPS[i + 1]?.at ?? 1) - x.at }}
                className={`basis-0 border-l border-line px-2 pt-[9px] font-mono text-[10px] tracking-[0.08em] uppercase transition-colors duration-300 first:border-l-0 ${i === s.stop ? "text-ink" : "text-faint"}`}
              >
                {x.label}
              </span>
            ))}
            <div className="pointer-events-none absolute inset-y-0 right-px left-0">
              <motion.div style={{ x: playX }} className="absolute inset-0">
                <span className="absolute -inset-y-px left-0 w-px bg-accent" />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 place-items-center px-3 pt-3 pb-10 [container-type:size] md:col-span-7">
          <div className="relative" style={{ aspectRatio: `${s.w} / ${s.h}`, width: `min(100cqw, 100cqh * ${s.w / s.h})` }}>
            <Corners />
            <div className="h-full w-full overflow-hidden rounded-[10px] border border-line bg-panel">
              <ReflowStage w={s.w} h={s.h} theme={s.theme} />
            </div>
            <p className={`absolute inset-x-0 top-full mt-4 flex justify-between gap-4 whitespace-nowrap tabular-nums ${LABEL}`}>
              <span className="text-ink">
                {s.w} × {s.h}
              </span>
              <span>
                {THEME_PRESETS[s.theme].name} · {FPS} fps
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
