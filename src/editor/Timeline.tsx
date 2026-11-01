"use client";

import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { FPS, projectDuration, sceneStarts, TRANSITION_FRAMES } from "@/video/schema";
import { LAYER_META, layerTitle, pad2 } from "./Panels";
import { enterFrame, useEditor } from "./store";
import { cx, IconButton, Label, tc } from "./ui";

const LABEL_STEPS = [0.5, 1, 2, 5, 10, 30, 60]; // seconds between ruler labels
const LABEL_MIN_PX = 92;
const pct = (f: number, total: number) => `${(f / total) * 100}%`;

/** Ruler ticks as background gradients so they scale with the lane, no per-tick DOM. */
const ticks = (stepFrames: number, total: number, h: number) => ({
  backgroundImage: "linear-gradient(to right, var(--color-faint) 1px, transparent 1px)",
  backgroundSize: `${(stepFrames / total) * 100}% ${h}px`,
  backgroundRepeat: "repeat-x",
  backgroundPosition: "left bottom",
});

export function Timeline() {
  const { state, scene: current, layer: selected, player, select, focus } = useEditor();
  const { project } = state;
  const total = projectDuration(project);
  const starts = sceneStarts(project);
  const si = project.scenes.indexOf(current);
  const lanes = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [laneW, setLaneW] = useState(800);

  useEffect(() => {
    const el = lanes.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLaneW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Playhead + clock follow the player imperatively: 30 updates/s shouldn't re-render React.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const sync = () => {
      const f = p.getCurrentFrame();
      if (head.current) head.current.style.transform = `translateX(${(f / total) * (lanes.current?.clientWidth ?? 0)}px)`;
      if (time.current) time.current.textContent = tc(f);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    sync();
    const ro = new ResizeObserver(sync);
    if (lanes.current) ro.observe(lanes.current);
    p.addEventListener("frameupdate", sync);
    p.addEventListener("seeked", sync);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      ro.disconnect();
      p.removeEventListener("frameupdate", sync);
      p.removeEventListener("seeked", sync);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [player, total]);

  const seekFrame = (f: number) => {
    player.current?.pause();
    player.current?.seekTo(f);
    const i = starts.findLastIndex((s) => s <= f);
    if (project.scenes[i] && project.scenes[i].id !== current.id) select({ sceneId: project.scenes[i].id, layerId: null });
  };
  const seekFromPointer = (clientX: number) => {
    const r = lanes.current!.getBoundingClientRect();
    seekFrame(Math.round(Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * (total - 1)));
  };
  const jump = (dir: -1 | 1) => {
    const f = player.current?.getCurrentFrame() ?? 0;
    const target = dir < 0 ? starts.findLast((s) => s < f - 1) ?? 0 : starts.find((s) => s > f) ?? total - 1;
    seekFrame(target);
  };

  const pxPerSec = (laneW / total) * FPS;
  const step = LABEL_STEPS.find((s) => s * pxPerSec >= LABEL_MIN_PX) ?? 60;
  const labels = Array.from({ length: Math.floor(total / (step * FPS)) + 1 }, (_, i) => i * step * FPS).filter((f) => (f / total) * laneW + 72 <= laneW);

  const sceneStart = starts[si];
  const sceneEnd = sceneStart + current.durationInFrames;

  // Scrub on any lane; buttons inside lanes stop propagation to select instead.
  const scrub = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      seekFromPointer(e.clientX);
    },
    onPointerMove: (e: React.PointerEvent) => e.buttons === 1 && seekFromPointer(e.clientX),
  };

  return (
    <section aria-label="Timeline" className="flex flex-col border-t border-line bg-panel select-none [--th:52px] lg:[--th:248px]">
      {/* Transport */}
      <div className="flex h-10 items-center gap-1 border-b border-line px-2">
        <IconButton label="Previous scene" onClick={() => jump(-1)}>
          <SkipBackIcon size={14} weight="fill" />
        </IconButton>
        <button
          onClick={() => player.current?.toggle()}
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          className="press grid size-7 shrink-0 place-items-center rounded-md bg-ink text-canvas hover:bg-ink/85"
        >
          {playing ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
        </button>
        <IconButton label="Next scene" onClick={() => jump(1)}>
          <SkipForwardIcon size={14} weight="fill" />
        </IconButton>
        <div className="ml-2 font-mono text-[13px] whitespace-nowrap tabular-nums">
          <span ref={time} className="text-ink">
            00:00:00:00
          </span>
          <span className="text-faint"> / {tc(total)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase tabular-nums max-sm:hidden">
          <span>{total} f</span>
          <span>{FPS} fps</span>
          <span>{pad2(project.scenes.length)} scn</span>
        </div>
      </div>

      <div className="relative grid grid-cols-[var(--th)_minmax(0,1fr)]">
        {/* Ruler */}
        <div className="flex h-6 items-center border-r border-b border-line px-3">
          <Label className="text-faint max-lg:hidden">Timecode</Label>
          <Label className="text-faint lg:hidden">TC</Label>
        </div>
        <div ref={lanes} className="relative h-6 cursor-ew-resize touch-none border-b border-line" {...scrub}>
          <div className="absolute inset-0" style={ticks((step * FPS) / 5, total, 4)} />
          <div className="absolute inset-0" style={ticks(step * FPS, total, 9)} />
          {labels.map((f) => (
            <span key={f} className="absolute top-1 pl-1 font-mono text-[9.5px] leading-none text-muted tabular-nums" style={{ left: pct(f, total) }}>
              {tc(f)}
            </span>
          ))}
        </div>

        {/* V1: scenes, sized by length, transitions drawn as overlaps */}
        <div className="flex h-11 items-center gap-2 border-r border-b border-line px-3">
          <span className="font-mono text-[10.5px] text-ink">V1</span>
          <span className="truncate text-[12px] text-muted max-lg:hidden">Scenes</span>
        </div>
        <div className="relative h-11 cursor-ew-resize touch-none border-b border-line" {...scrub}>
          {project.scenes.map((s, i) => {
            const active = s.id === current.id;
            const overlap = i > 0 && s.transition !== "none";
            return (
              <div
                key={s.id}
                title={`${s.name} · ${tc(s.durationInFrames)}${overlap ? ` · ${s.transition} in` : ""}`}
                className={cx(
                  "absolute inset-y-1.5 flex overflow-hidden rounded-[4px] border transition-colors duration-150",
                  active ? "z-10 border-accent/60 bg-accent-soft" : "border-[#d9d9d5] bg-white hover:border-[#c4c4bf]",
                )}
                style={{ left: pct(starts[i], total), width: pct(s.durationInFrames, total) }}
              >
                {overlap && (
                  <span
                    aria-hidden
                    className={cx("h-full shrink-0 border-r", active ? "border-accent/40" : "border-[#d9d9d5]")}
                    style={{
                      width: `${(TRANSITION_FRAMES / s.durationInFrames) * 100}%`,
                      backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${active ? "var(--color-accent)" : "var(--color-faint)"} 50%, transparent calc(50% + 0.5px))`,
                    }}
                  />
                )}
                <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5">
                  <span className={cx("font-mono text-[10px] tabular-nums", active ? "text-accent" : "text-faint")}>{pad2(i + 1)}</span>
                  <span className={cx("truncate text-[11.5px] font-medium", active ? "text-ink" : "text-muted")}>{s.name}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Layer rows for the selected scene: bar from entrance to scene out */}
        <div className="col-span-2 grid max-h-[92px] min-h-[46px] grid-cols-[var(--th)_minmax(0,1fr)] overflow-y-auto [scrollbar-width:none]">
          {current.layers.map((l, i) => {
            const enter = enterFrame(current, l.id);
            const active = l.id === selected?.id;
            const { icon: I, label } = LAYER_META[l.type];
            return (
              <div key={l.id} className="contents">
                <button
                  onClick={() => focus(current.id, l.id)}
                  className={cx("flex h-[23px] min-w-0 items-center gap-2 border-r border-line px-3 text-left", active ? "bg-accent-soft" : "hover:bg-hover/60")}
                >
                  <span className={cx("w-5 shrink-0 font-mono text-[10.5px]", active ? "text-accent" : "text-muted")}>L{i + 1}</span>
                  <I size={12} className="shrink-0 text-muted max-lg:hidden" aria-label={label} />
                  <span className={cx("truncate text-[11.5px] max-lg:hidden", l.hidden ? "text-faint line-through" : "text-ink")}>{layerTitle(l)}</span>
                </button>
                <div className="relative h-[23px] cursor-ew-resize touch-none" {...scrub}>
                  <div className="absolute inset-y-0 bg-ink/[0.025]" style={{ left: pct(sceneStart, total), width: pct(current.durationInFrames, total) }} />
                  {enter !== null && (
                    <button
                      aria-label={`Select ${label} layer L${i + 1}, enters at ${tc(enter)}`}
                      title={`${layerTitle(l)} · in ${tc(enter)}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => focus(current.id, l.id)}
                      className={cx(
                        "absolute inset-y-[5px] flex items-center rounded-[3px] border pr-1 pl-2.5 text-left",
                        active ? "border-accent/60 bg-accent-soft" : "border-[#d9d9d5] bg-white hover:border-[#c4c4bf]",
                      )}
                      style={{ left: pct(sceneStart + enter, total), width: pct(Math.max(1, sceneEnd - sceneStart - enter), total) }}
                    >
                      <span aria-hidden className={cx("absolute top-1/2 -left-[4px] size-[7px] -translate-y-1/2 rotate-45", active ? "bg-accent" : "bg-ink")} />
                      <span className="truncate font-mono text-[9.5px] text-muted tabular-nums">{tc(enter)}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {current.layers.length === 0 && <p className="col-span-2 px-3 py-3 text-[11.5px] text-muted">No layers in this scene.</p>}
        </div>

        {/* Playhead spans ruler and every lane */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-[var(--th)]">
          <div ref={head} className="absolute inset-y-0 left-0 will-change-transform">
            <div className="absolute inset-y-0 -left-px w-px bg-accent" />
            <div className="absolute top-0 -left-[5px] h-[9px] w-[11px] bg-accent [clip-path:polygon(0_0,100%_0,100%_55%,50%_100%,0_55%)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
