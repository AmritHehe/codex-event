"use client";

import {
  ChartBarIcon,
  CopyIcon,
  CursorClickIcon,
  DotsSixVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  ImageIcon,
  ListChecksIcon,
  PlusIcon,
  TagIcon,
  TextTIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Thumbnail } from "@remotion/player";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LaunchVideo } from "@/video/LaunchVideo";
import { ASPECTS, FPS, projectDuration, type Layer, type LayerType, type Scene } from "@/video/schema";
import { focusFrame, LAYER_DEFAULTS, newId, ops, sceneCopy, useEditor } from "./store";
import { IconButton, PanelTitle } from "./ui";

export const LAYER_META: Record<LayerType, { label: string; icon: Icon }> = {
  text: { label: "Text", icon: TextTIcon },
  badge: { label: "Badge", icon: TagIcon },
  image: { label: "Image", icon: ImageIcon },
  list: { label: "List", icon: ListChecksIcon },
  stat: { label: "Stat", icon: ChartBarIcon },
  cta: { label: "Button", icon: CursorClickIcon },
};

const layerTitle = (l: Layer) => {
  const raw = "text" in l ? l.text : l.type === "list" ? l.items[0] : l.type === "stat" ? `${l.prefix ?? ""}${l.value}${l.suffix ?? ""}` : "Screenshot";
  return raw.replaceAll("*", "");
};

const BLANK_SCENE = (): Scene => ({
  id: newId(),
  name: "New scene",
  durationInFrames: 90,
  layout: "stack",
  background: "mesh",
  transition: "fade",
  layers: [{ id: newId(), ...LAYER_DEFAULTS.text }],
});

export function ScenesPanel() {
  const { state, scene: current, edit, focus } = useEditor();
  const { project } = state;
  const { width, height } = ASPECTS[project.aspect];
  const total = projectDuration(project);

  const add = () => {
    const s = BLANK_SCENE();
    edit(ops.duplicateScene(current.id, s), undefined, { sceneId: s.id, layerId: null });
  };

  return (
    <section className="flex max-h-[52%] min-h-0 shrink-0 flex-col border-b border-line">
      <PanelTitle
        action={
          <IconButton label="Add scene" onClick={add}>
            <PlusIcon size={14} weight="bold" />
          </IconButton>
        }
      >
        Scenes
      </PanelTitle>
      <Reorder.Group
        axis="y"
        values={project.scenes}
        onReorder={(scenes) => edit(ops.setScenes(scenes), "reorder-scenes")}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2"
      >
        {project.scenes.map((s, i) => {
          const active = s.id === current.id;
          return (
            <Reorder.Item
              key={s.id}
              value={s}
              className={`group flex cursor-grab items-center gap-2.5 rounded-lg p-1.5 active:cursor-grabbing ${active ? "bg-accent-soft" : "hover:bg-hover"}`}
              onClick={() => focus(s.id)}
            >
              <div
                className={`w-[72px] shrink-0 overflow-hidden rounded-md ring-1 ${active ? "ring-accent" : "ring-line"}`}
                style={{ aspectRatio: `${width} / ${height}`, maxHeight: 72, width: width < height ? 40 : 72 }}
              >
                <Thumbnail
                  component={LaunchVideo}
                  inputProps={{ project }}
                  compositionWidth={width}
                  compositionHeight={height}
                  durationInFrames={total}
                  fps={FPS}
                  frameToDisplay={focusFrame(project, s.id)}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{s.name}</p>
                <p className="font-mono text-[11px] text-muted">
                  {i + 1} · {(s.durationInFrames / FPS).toFixed(1)}s
                </p>
              </div>
              <div className="flex opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                <IconButton
                  label="Duplicate scene"
                  onClick={(e) => {
                    e.stopPropagation();
                    const copy = sceneCopy(s);
                    edit(ops.duplicateScene(s.id, copy), undefined, { sceneId: copy.id, layerId: null });
                  }}
                >
                  <CopyIcon size={14} />
                </IconButton>
                <IconButton
                  label="Delete scene"
                  disabled={project.scenes.length < 2}
                  onClick={(e) => {
                    e.stopPropagation();
                    edit(ops.removeScene(s.id));
                  }}
                >
                  <TrashIcon size={14} />
                </IconButton>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </section>
  );
}

function AddLayerMenu({ onAdd }: { onAdd: (t: LayerType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label="Add layer" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <PlusIcon size={14} weight="bold" />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, transform: "scale(0.96) translateY(-4px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-8 right-0 z-20 w-44 rounded-xl bg-white p-1 shadow-pop"
          >
            {(Object.keys(LAYER_META) as LayerType[]).map((t) => {
              const { label, icon: I } = LAYER_META[t];
              return (
                <button
                  key={t}
                  role="menuitem"
                  onClick={() => {
                    onAdd(t);
                    setOpen(false);
                  }}
                  className="press flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] hover:bg-hover"
                >
                  <I size={15} className="text-muted" />
                  {label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LayerRow({ layer, sceneId, active }: { layer: Layer; sceneId: string; active: boolean }) {
  const { edit, focus } = useEditor();
  const drag = useDragControls();
  const { icon: I } = LAYER_META[layer.type];
  return (
    <Reorder.Item
      value={layer}
      dragListener={false}
      dragControls={drag}
      onClick={() => focus(sceneId, layer.id)}
      className={`group flex h-8 cursor-default items-center gap-1.5 rounded-lg pr-1 pl-0.5 ${active ? "bg-accent-soft text-ink" : "hover:bg-hover"} ${layer.hidden ? "text-faint" : ""}`}
    >
      <span
        onPointerDown={(e) => drag.start(e)}
        className="grid h-full w-5 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing"
        aria-hidden
      >
        <DotsSixVerticalIcon size={14} weight="bold" />
      </span>
      <I size={15} className={active ? "text-accent" : "text-muted"} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{layerTitle(layer)}</span>
      <IconButton
        label={layer.hidden ? "Show layer" : "Hide layer"}
        className={layer.hidden ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}
        onClick={(e) => {
          e.stopPropagation();
          edit(ops.updateLayer(sceneId, layer.id, { hidden: !layer.hidden }));
        }}
      >
        {layer.hidden ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
      </IconButton>
      <IconButton
        label="Delete layer"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          edit(ops.removeLayer(sceneId, layer.id));
        }}
      >
        <TrashIcon size={14} />
      </IconButton>
    </Reorder.Item>
  );
}

export function LayersPanel() {
  const { scene, layer: selected, edit } = useEditor();
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        action={
          <AddLayerMenu
            onAdd={(t) => {
              const l = { id: newId(), ...LAYER_DEFAULTS[t] } as Layer;
              edit(ops.addLayer(scene.id, l), undefined, { sceneId: scene.id, layerId: l.id });
            }}
          />
        }
      >
        Layers
      </PanelTitle>
      {scene.layers.length === 0 ? (
        <p className="px-3 pb-3 text-[12px] leading-relaxed text-muted">This scene is empty. Add a text, image or button layer with the plus above.</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={scene.layers}
          onReorder={(layers) => edit(ops.setLayers(scene.id, layers), `reorder-${scene.id}`)}
          className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
        >
          {scene.layers.map((l) => (
            <LayerRow key={l.id} layer={l} sceneId={scene.id} active={l.id === selected?.id} />
          ))}
        </Reorder.Group>
      )}
    </section>
  );
}
