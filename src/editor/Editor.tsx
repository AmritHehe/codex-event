"use client";

import { ArrowArcLeftIcon, ArrowArcRightIcon, BroadcastIcon } from "@phosphor-icons/react";
import { Player } from "@remotion/player";
import { MotionConfig } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LaunchVideo } from "@/video/LaunchVideo";
import { ASPECTS, aspectSchema, FPS, projectDuration } from "@/video/schema";
import { Inspector } from "./Inspector";
import { LayersPanel, pad2, ScenesPanel } from "./Panels";
import { EditorProvider, focusFrame, ops, useEditor } from "./store";
import { Timeline } from "./Timeline";
import { cx, IconButton, isTyping, Segmented } from "./ui";

export function Editor() {
  return (
    <MotionConfig reducedMotion="user">
      <EditorProvider>
        <EditorShell />
      </EditorProvider>
    </MotionConfig>
  );
}

function useShortcuts() {
  const { undo, redo, edit, scene, layer, select, player } = useEditor();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return; // inputs keep their native undo/space/backspace
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        e.preventDefault();
        player.current?.toggle();
      } else if ((e.key === "Backspace" || e.key === "Delete") && layer) {
        e.preventDefault();
        edit(ops.removeLayer(scene.id, layer.id), undefined, { sceneId: scene.id, layerId: null });
      } else if (e.key === "Escape" && layer) {
        select({ sceneId: scene.id, layerId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, edit, scene.id, layer, select, player]);
}

const MOBILE_TABS = [
  { id: "scenes", label: "Scenes and layers" },
  { id: "inspector", label: "Inspector" },
] as const;

function EditorShell() {
  const { state, scene, edit, undo, redo, player } = useEditor();
  const { project } = state;
  const { width, height } = ASPECTS[project.aspect];
  const [tab, setTab] = useState<"scenes" | "inspector">("scenes");
  const si = project.scenes.indexOf(scene);
  useShortcuts();

  return (
    // Desktop: 3-column grid with a full-width timeline. Below lg: one scrolling column, panels behind tabs.
    <div className="flex min-h-full flex-col bg-canvas lg:grid lg:h-full lg:grid-cols-[248px_minmax(0,1fr)_296px] lg:grid-rows-[44px_minmax(0,1fr)_auto]">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel pr-2 pl-1.5 lg:col-span-3">
        <input
          aria-label="Project name"
          value={project.name}
          onChange={(e) => edit(ops.setProject({ name: e.target.value }), "name")}
          className="h-7 w-48 min-w-0 rounded-md bg-transparent px-1.5 text-[13px] font-medium outline-none hover:bg-hover focus:bg-white focus:shadow-[0_0_0_1px_var(--color-line)] focus-visible:outline-none! max-sm:flex-1"
        />
        <span aria-hidden className="mx-1 h-4 w-px bg-line max-sm:hidden" />
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!state.past.length}>
          <ArrowArcLeftIcon size={15} />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!state.future.length}>
          <ArrowArcRightIcon size={15} />
        </IconButton>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/distribution" className="press inline-flex h-7 items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-canvas hover:bg-ink/85" aria-label="Distribute">
            <BroadcastIcon size={14} />
            <span className="max-sm:hidden">Distribute</span>
          </Link>
        </div>
      </header>

      <aside className={cx("min-h-0 flex-col border-line bg-panel max-lg:order-4 max-lg:min-h-[420px] lg:col-start-1 lg:row-start-2 lg:flex lg:border-r", tab === "scenes" ? "flex" : "hidden")}>
        <ScenesPanel />
        <LayersPanel />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col max-lg:order-1 max-lg:h-[46dvh] max-lg:min-h-[300px] lg:col-start-2 lg:row-start-2">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3">
          <span className="font-mono text-[10.5px] text-muted tabular-nums">
            SCN {pad2(si + 1)}
            <span className="text-faint"> / {pad2(project.scenes.length)}</span>
          </span>
          <span className="min-w-0 truncate text-[12px] font-medium max-sm:hidden">{scene.name}</span>
          <div className="ml-auto w-[150px] shrink-0">
            <Segmented mono label="Aspect ratio" value={project.aspect} options={aspectSchema.options} onChange={(aspect) => edit(ops.setProject({ aspect }))} />
          </div>
          <span className="font-mono text-[10.5px] whitespace-nowrap text-muted tabular-nums max-sm:hidden">
            {width} × {height}
          </span>
        </div>
        {/* Size container: the stage fits the free area at any aspect without letterboxing. */}
        <div className="grid min-h-0 flex-1 place-items-center p-4 [container-type:size] lg:p-8">
          <div
            className="overflow-hidden rounded-[10px] bg-white ring-1 ring-ink/10"
            style={{ aspectRatio: `${width} / ${height}`, width: `min(100cqw, 100cqh * ${width / height})` }}
          >
            <Player
              ref={player}
              component={LaunchVideo}
              inputProps={{ project }}
              durationInFrames={projectDuration(project)}
              compositionWidth={width}
              compositionHeight={height}
              fps={FPS}
              style={{ width: "100%", height: "100%" }}
              initialFrame={focusFrame(project, project.scenes[0].id)}
              loop
              clickToPlay
              acknowledgeRemotionLicense
            />
          </div>
        </div>
      </main>

      <aside className={cx("min-h-0 overflow-y-auto border-line bg-panel max-lg:order-4 lg:col-start-3 lg:row-start-2 lg:block lg:border-l", tab === "inspector" ? "block" : "hidden")}>
        <Inspector />
      </aside>

      <div className="max-lg:order-2 lg:col-span-3 lg:row-start-3">
        <Timeline />
      </div>

      <div role="tablist" aria-label="Panels" className="flex h-10 shrink-0 border-y border-line bg-panel max-lg:order-3 lg:hidden">
        {MOBILE_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx("relative flex-1 text-[12px] font-medium", tab === t.id ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink" : "text-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
