"use client";

import { ArrowArcLeftIcon, ArrowArcRightIcon, BroadcastIcon } from "@phosphor-icons/react";
import { Player } from "@remotion/player";
import Link from "next/link";
import { useEffect } from "react";
import { LaunchVideo } from "@/video/LaunchVideo";
import { ASPECTS, aspectSchema, FPS, projectDuration } from "@/video/schema";
import { Inspector } from "./Inspector";
import { LayersPanel, ScenesPanel } from "./Panels";
import { EditorProvider, focusFrame, ops, useEditor } from "./store";
import { Timeline } from "./Timeline";
import { IconButton, Segmented } from "./ui";

export function Editor() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  );
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

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

function EditorShell() {
  const { state, edit, undo, redo, player } = useEditor();
  const { project } = state;
  const { width, height } = ASPECTS[project.aspect];
  useShortcuts();

  return (
    <div className="grid h-dvh grid-rows-[52px_1fr] lg:grid-cols-[264px_1fr_304px] lg:grid-rows-[52px_1fr]">
      <header className="col-span-full flex items-center gap-3 border-b border-line bg-panel px-3">
        <input
          aria-label="Project name"
          value={project.name}
          onChange={(e) => edit(ops.setProject({ name: e.target.value }), "name")}
          className="h-8 w-56 rounded-lg bg-transparent px-2 text-[14px] font-semibold outline-none hover:bg-hover focus:bg-hover"
        />
        <div className="flex items-center gap-0.5">
          <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!state.past.length}>
            <ArrowArcLeftIcon size={16} />
          </IconButton>
          <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!state.future.length}>
            <ArrowArcRightIcon size={16} />
          </IconButton>
        </div>
        <div className="mx-auto w-56">
          <Segmented label="Aspect ratio" value={project.aspect} options={aspectSchema.options} onChange={(aspect) => edit(ops.setProject({ aspect }))} />
        </div>
        <Link href="/distribution" className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink/85">
          <BroadcastIcon size={15} weight="bold" />
          Distribute
        </Link>
      </header>

      <aside className="flex min-h-0 flex-col border-r border-line bg-panel max-lg:hidden">
        <ScenesPanel />
        <LayersPanel />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        {/* Size container: the stage fits the free area at any aspect without letterboxing. */}
        <div className="grid min-h-0 flex-1 place-items-center p-6 [container-type:size]">
          <div
            className="overflow-hidden rounded-xl bg-white shadow-[0_24px_48px_-16px_rgb(24_24_27/0.18),0_0_0_1px_rgb(24_24_27/0.06)]"
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
        <Timeline />
      </main>

      <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel max-lg:hidden">
        <Inspector />
      </aside>
    </div>
  );
}
