"use client";

import type { PlayerRef } from "@remotion/player";
import { createContext, useContext, useEffect, useReducer, useRef, type RefObject } from "react";
import { MOCK_SCREENSHOT, sampleProject } from "@/video/sample";
import { autoDelay, projectSchema, sceneStarts, TRANSITION_FRAMES, type Layer, type LayerType, type Project, type Scene } from "@/video/schema";

const STORAGE_KEY = "shipcast:project";
const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

type Selection = { sceneId: string; layerId: string | null };
type State = { project: Project; sel: Selection; past: Project[]; future: Project[]; lastKey?: string; lastAt: number };
type Action =
  | { type: "load"; project: Project }
  | { type: "select"; sel: Selection }
  | { type: "edit"; fn: (p: Project) => Project; key?: string; at: number; sel?: Selection }
  | { type: "undo" }
  | { type: "redo" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load":
      return { project: a.project, sel: { sceneId: a.project.scenes[0].id, layerId: null }, past: [], future: [], lastAt: 0 };
    case "select":
      return { ...s, sel: a.sel, lastKey: undefined };
    case "edit": {
      const next = a.fn(s.project);
      if (next === s.project) return s;
      // Typing in a field = one undo step, not one per keystroke.
      const coalesce = a.key && a.key === s.lastKey && a.at - s.lastAt < COALESCE_MS;
      return {
        project: next,
        sel: a.sel ?? s.sel,
        past: coalesce ? s.past : [...s.past, s.project].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: a.key,
        lastAt: a.at,
      };
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], lastKey: undefined };
    }
    case "redo": {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { ...s, project: next, past: [...s.past, s.project], future: rest, lastKey: undefined };
    }
  }
}

// ---------- pure project ops ----------

export const newId = () => crypto.randomUUID().slice(0, 8);

const mapScene = (p: Project, sceneId: string, fn: (s: Scene) => Scene): Project => ({
  ...p,
  scenes: p.scenes.map((s) => (s.id === sceneId ? fn(s) : s)),
});

export const ops = {
  setProject: (patch: Partial<Project>) => (p: Project) => ({ ...p, ...patch }),
  updateScene: (sceneId: string, patch: Partial<Scene>) => (p: Project) => mapScene(p, sceneId, (s) => ({ ...s, ...patch })),
  updateLayer: (sceneId: string, layerId: string, patch: Partial<Layer>) => (p: Project) =>
    mapScene(p, sceneId, (s) => ({ ...s, layers: s.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as Layer) : l)) })),
  setLayers: (sceneId: string, layers: Layer[]) => (p: Project) => mapScene(p, sceneId, (s) => ({ ...s, layers })),
  removeLayer: (sceneId: string, layerId: string) => (p: Project) =>
    mapScene(p, sceneId, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== layerId) })),
  addLayer: (sceneId: string, layer: Layer) => (p: Project) => mapScene(p, sceneId, (s) => ({ ...s, layers: [...s.layers, layer] })),
  setScenes: (scenes: Scene[]) => (p: Project) => ({ ...p, scenes }),
  duplicateScene: (sceneId: string, copy: Scene) => (p: Project) => {
    const i = p.scenes.findIndex((s) => s.id === sceneId);
    return { ...p, scenes: [...p.scenes.slice(0, i + 1), copy, ...p.scenes.slice(i + 1)] };
  },
  removeScene: (sceneId: string) => (p: Project) =>
    p.scenes.length > 1 ? { ...p, scenes: p.scenes.filter((s) => s.id !== sceneId) } : p,
};

export const LAYER_DEFAULTS: { [T in LayerType]: Omit<Extract<Layer, { type: T }>, "id"> } = {
  text: { type: "text", role: "headline", text: "New *headline*" },
  badge: { type: "badge", text: "New" },
  image: { type: "image", src: MOCK_SCREENSHOT, frame: "browser", size: "md" },
  list: { type: "list", items: ["First point", "Second point", "Third point"] },
  stat: { type: "stat", value: 100, suffix: "%", label: "Describe this number" },
  cta: { type: "cta", text: "Get started" },
};

export const sceneCopy = (s: Scene): Scene => ({
  ...s,
  id: newId(),
  name: `${s.name} copy`,
  layers: s.layers.map((l) => ({ ...l, id: newId() })),
});

/** Frame that best shows a scene (past its intro transition) or a layer (after its entrance settles). */
export function focusFrame(p: Project, sceneId: string, layerId?: string | null) {
  const i = Math.max(0, p.scenes.findIndex((s) => s.id === sceneId));
  const scene = p.scenes[i];
  const start = sceneStarts(p)[i];
  const last = start + scene.durationInFrames - TRANSITION_FRAMES - 1;
  const visible = scene.layers.filter((l) => !l.hidden);
  const li = visible.findIndex((l) => l.id === layerId);
  const offset = li >= 0 ? (visible[li].delay ?? autoDelay(li)) + 24 : 45;
  return Math.max(start, Math.min(start + offset, last));
}

// ---------- context ----------

type Ctx = {
  state: State;
  scene: Scene;
  layer: Layer | null;
  select: (sel: Selection) => void;
  edit: (fn: (p: Project) => Project, key?: string, sel?: Selection) => void;
  undo: () => void;
  redo: () => void;
  load: (p: Project) => void;
  player: RefObject<PlayerRef | null>;
  /** Select a scene/layer and park the playhead where it's visible. */
  focus: (sceneId: string, layerId?: string | null) => void;
};

const EditorCtx = createContext<Ctx | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, sampleProject, (p) => reducer({} as State, { type: "load", project: p }));
  const player = useRef<PlayerRef | null>(null);
  const hydrated = useRef(false);

  // Restore autosave once (client only), then persist on every change.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? projectSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) dispatch({ type: "load", project: parsed.data });
    } catch {
      // corrupt or blocked storage: keep the sample
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
      } catch {
        // storage full or blocked: editing still works, just not persisted
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state.project]);

  // Selection can go stale after undo/delete; resolve it here so panels never see a missing id.
  const scene = state.project.scenes.find((s) => s.id === state.sel.sceneId) ?? state.project.scenes[0];
  const layer = scene.layers.find((l) => l.id === state.sel.layerId) ?? null;

  const value: Ctx = {
    state,
    scene,
    layer,
    player,
    select: (sel) => dispatch({ type: "select", sel }),
    edit: (fn, key, sel) => dispatch({ type: "edit", fn, key, sel, at: Date.now() }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    load: (project) => dispatch({ type: "load", project }),
    focus: (sceneId, layerId = null) => {
      dispatch({ type: "select", sel: { sceneId, layerId } });
      player.current?.pause();
      player.current?.seekTo(focusFrame(state.project, sceneId, layerId));
    },
  };
  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error("useEditor must be used inside EditorProvider");
  return ctx;
}
