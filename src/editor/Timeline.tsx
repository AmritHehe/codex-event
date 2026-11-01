"use client";

import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { FPS, projectDuration, sceneStarts } from "@/video/schema";
import { useEditor } from "./store";

const fmt = (frame: number) => {
  const s = frame / FPS;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

export function Timeline() {
  const { state, scene: current, player, select } = useEditor();
  const { project } = state;
  const total = projectDuration(project);
  const starts = sceneStarts(project);
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);

  // Playhead + clock follow the player imperatively: 30 updates/s shouldn't re-render React.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const sync = () => {
      const f = p.getCurrentFrame();
      if (head.current) head.current.style.transform = `translateX(${(f / total) * (track.current?.clientWidth ?? 0)}px)`;
      if (time.current) time.current.textContent = fmt(f);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    sync();
    p.addEventListener("frameupdate", sync);
    p.addEventListener("seeked", sync);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", sync);
      p.removeEventListener("seeked", sync);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [player, total]);

  const seekFromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const f = Math.round(Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * (total - 1));
    player.current?.seekTo(f);
    const i = starts.findLastIndex((s) => s <= f);
    if (project.scenes[i] && project.scenes[i].id !== current.id) select({ sceneId: project.scenes[i].id, layerId: null });
  };

  return (
    <div className="flex h-[92px] shrink-0 items-center gap-4 border-t border-line bg-panel px-4">
      <button
        onClick={() => player.current?.toggle()}
        aria-label={playing ? "Pause (space)" : "Play (space)"}
        className="press grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-ink/85"
      >
        {playing ? <PauseIcon size={15} weight="fill" /> : <PlayIcon size={15} weight="fill" />}
      </button>
      <div className="shrink-0 font-mono text-[12px] whitespace-nowrap text-muted tabular-nums">
        <span ref={time} className="text-ink">
          0:00.0
        </span>
        <span> / {fmt(total)}</span>
      </div>

      <div
        ref={track}
        className="relative flex h-12 min-w-0 flex-1 cursor-pointer touch-none gap-0.5 select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          player.current?.pause();
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e.clientX)}
      >
        {project.scenes.map((s, i) => {
          const len = (starts[i + 1] ?? total) - starts[i];
          const active = s.id === current.id;
          return (
            <div
              key={s.id}
              style={{ flexGrow: len, flexBasis: 0 }}
              className={`flex min-w-0 flex-col justify-end rounded-md px-2 pb-1.5 transition-colors duration-150 ${
                active ? "bg-accent-soft ring-1 ring-accent/40 ring-inset" : "bg-hover"
              }`}
            >
              <span className={`truncate text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>{s.name}</span>
            </div>
          );
        })}
        <div ref={head} className="pointer-events-none absolute -top-1 -bottom-1 left-0 w-0.5 rounded-full bg-accent will-change-transform">
          <div className="absolute -top-1 -left-[5px] size-3 rounded-full border-2 border-white bg-accent shadow-sm" />
        </div>
      </div>
    </div>
  );
}
