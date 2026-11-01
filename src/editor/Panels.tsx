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
  TimerIcon,
  BellIcon,
  AppWindowIcon,
} from "@phosphor-icons/react";
import { Thumbnail } from "@remotion/player";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { LaunchVideo } from "@/video/LaunchVideo";
import { ASPECTS, FPS, projectDuration, type Layer, type LayerType, type Scene } from "@/video/schema";
import { focusFrame, LAYER_DEFAULTS, newId, ops, sceneCopy, useEditor } from "./store";
import { cx, IconButton, Kbd, PanelTitle, POP, tc, useDismiss } from "./ui";

export const LAYER_META: Record<LayerType, { label: string; icon: Icon }> = {
  text: { label: "Text", icon: TextTIcon },
  badge: { label: "Badge", icon: TagIcon },
  image: { label: "Image", icon: ImageIcon },
  list: { label: "List", icon: ListChecksIcon },
  stat: { label: "Stat", icon: ChartBarIcon },
  cta: { label: "Button", icon: CursorClickIcon },
  counter: { label: "Counter", icon: TimerIcon },
  peek: { label: "Peek", icon: BellIcon },
  windows: { label: "Windows", icon: AppWindowIcon },
};

export const layerTitle = (l: Layer) => {
  const raw =
    "text" in l ? l.text
    : l.type === "list" ? l.items[0]
    : l.type === "stat" ? `${l.prefix ?? ""}${l.value}${l.suffix ?? ""}`
    : l.type === "counter" ? l.label
    : l.type === "peek" ? l.title
    : l.type === "windows" ? l.titles.join(", ")
    : "Screenshot";
  return raw.replaceAll("*", "");
};

export const pad2 = (n: number) => String(n).padStart(2, "0");

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
  const portrait = width < height;

  const add = () => {
    const s = BLANK_SCENE();
    edit(ops.duplicateScene(current.id, s), undefined, { sceneId: s.id, layerId: null });
  };

  return (
    <section className="flex max-h-[55%] min-h-0 shrink-0 flex-col border-b border-line">
      <PanelTitle
        meta={pad2(project.scenes.length)}
        action={
          <IconButton label="Add scene" onClick={add}>
            <PlusIcon size={13} />
          </IconButton>
        }
      >
        Scenes
      </PanelTitle>
      <Reorder.Group
        axis="y"
        values={project.scenes}
        onReorder={(scenes) => edit(ops.setScenes(scenes), "reorder-scenes")}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-1.5"
      >
        {project.scenes.map((s, i) => {
          const active = s.id === current.id;
          return (
            <Reorder.Item
              key={s.id}
              value={s}
              whileDrag={{ boxShadow: "var(--shadow-pop)", backgroundColor: "#fbfbfa" }}
              className={cx(
                "group relative flex cursor-grab items-center gap-2.5 py-1.5 pr-1.5 pl-3 active:cursor-grabbing",
                active ? "bg-accent-soft" : "hover:bg-hover/60",
              )}
              onClick={() => focus(s.id)}
            >
              {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
              <span className={cx("w-5 shrink-0 font-mono text-[10.5px] tabular-nums", active ? "text-accent" : "text-faint")}>{pad2(i + 1)}</span>
              <div
                className={cx("shrink-0 overflow-hidden rounded-[3px] bg-canvas ring-1", active ? "ring-accent/50" : "ring-line")}
                style={{ aspectRatio: `${width} / ${height}`, width: portrait ? 26 : 64 }}
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
                <p className="truncate text-[12.5px] leading-tight font-medium">{s.name}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted tabular-nums">{tc(s.durationInFrames)}</p>
              </div>
              <div className="flex opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
                <IconButton
                  label="Duplicate scene"
                  onClick={(e) => {
                    e.stopPropagation();
                    const copy = sceneCopy(s);
                    edit(ops.duplicateScene(s.id, copy), undefined, { sceneId: copy.id, layerId: null });
                  }}
                >
                  <CopyIcon size={13} />
                </IconButton>
                <IconButton
                  label="Delete scene"
                  disabled={project.scenes.length < 2}
                  onClick={(e) => {
                    e.stopPropagation();
                    edit(ops.removeScene(s.id));
                  }}
                >
                  <TrashIcon size={13} />
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
  useDismiss(ref, open, useCallback(() => setOpen(false), []));

  return (
    <div ref={ref} className="relative">
      <IconButton label="Add layer" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <PlusIcon size={13} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" {...POP} style={{ transformOrigin: "top right" }} className="absolute top-8 right-0 z-30 w-44 rounded-[10px] border border-line bg-panel p-1 shadow-pop">
            <p className="px-2 pt-1 pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">New layer</span>
            </p>
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
                  className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] hover:bg-hover"
                >
                  <I size={14} className="text-muted" />
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

function LayerRow({ layer, index, sceneId, active }: { layer: Layer; index: number; sceneId: string; active: boolean }) {
  const { edit, focus } = useEditor();
  const drag = useDragControls();
  const { icon: I, label } = LAYER_META[layer.type];
  return (
    <Reorder.Item
      value={layer}
      dragListener={false}
      dragControls={drag}
      whileDrag={{ boxShadow: "var(--shadow-pop)", backgroundColor: "#fbfbfa" }}
      onClick={() => focus(sceneId, layer.id)}
      className={cx(
        "group relative flex h-8 cursor-default items-center gap-1.5 pr-1.5 pl-1",
        active ? "bg-accent-soft" : "hover:bg-hover/60",
        layer.hidden && "text-faint",
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <span onPointerDown={(e) => drag.start(e)} className="grid h-full w-5 cursor-grab touch-none place-items-center text-faint hover:text-muted active:cursor-grabbing" aria-hidden>
        <DotsSixVerticalIcon size={13} weight="bold" />
      </span>
      <span className={cx("w-5 shrink-0 font-mono text-[10.5px] tabular-nums", active ? "text-accent" : "text-faint")}>L{index + 1}</span>
      <I size={14} className={cx("shrink-0", active ? "text-ink" : "text-muted")} aria-label={label} />
      <span className={cx("min-w-0 flex-1 truncate text-[12.5px]", layer.hidden && "line-through decoration-faint")}>{layerTitle(layer)}</span>
      <IconButton
        label={layer.hidden ? "Show layer" : "Hide layer"}
        className={layer.hidden ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"}
        onClick={(e) => {
          e.stopPropagation();
          edit(ops.updateLayer(sceneId, layer.id, { hidden: !layer.hidden }));
        }}
      >
        {layer.hidden ? <EyeSlashIcon size={13} /> : <EyeIcon size={13} />}
      </IconButton>
      <IconButton
        label="Delete layer"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          edit(ops.removeLayer(sceneId, layer.id));
        }}
      >
        <TrashIcon size={13} />
      </IconButton>
    </Reorder.Item>
  );
}

export function LayersPanel() {
  const { state, scene, layer: selected, edit } = useEditor();
  const index = state.project.scenes.indexOf(scene);
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        meta={`SCN ${pad2(index + 1)}`}
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
          className="flex min-h-0 flex-col overflow-y-auto pb-2"
        >
          {scene.layers.map((l, i) => (
            <LayerRow key={l.id} layer={l} index={i} sceneId={scene.id} active={l.id === selected?.id} />
          ))}
        </Reorder.Group>
      )}
      <p className="mt-auto hidden items-center gap-1.5 border-t border-line px-3 py-2 text-[11px] text-muted lg:flex">
        <Kbd>Space</Kbd> play <Kbd>⌫</Kbd> delete <Kbd>/</Kbd> prompt
      </p>
    </section>
  );
}
