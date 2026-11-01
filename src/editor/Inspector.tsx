"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { THEME_PRESETS } from "@/video/themes";
import { animationSchema, fontSchema, FPS, sceneSchema, textLayerSchema, type Layer, type Scene, type Theme } from "@/video/schema";
import { LAYER_META } from "./Panels";
import { ops, useEditor } from "./store";
import { ColorField, Field, Segmented, Select, TextArea, TextInput, Toggle } from "./ui";

export function Inspector() {
  const [tab, setTab] = useState<"edit" | "theme">("edit");
  const { layer } = useEditor();
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-line bg-panel p-3">
        <Segmented label="Inspector" value={tab} options={["edit", "theme"] as const} onChange={setTab} />
      </div>
      <div className="flex flex-col gap-4 p-4">{tab === "theme" ? <ThemeInspector /> : layer ? <LayerInspector layer={layer} /> : <SceneInspector />}</div>
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[13px] font-semibold">{children}</h3>;

function SceneInspector() {
  const { scene, edit } = useEditor();
  const set = (patch: Partial<Scene>, key?: string) => edit(ops.updateScene(scene.id, patch), key && `${scene.id}:${key}`);
  const S = sceneSchema.shape;
  return (
    <>
      <Heading>Scene</Heading>
      <Field label="Name">{(id) => <TextInput id={id} value={scene.name} onChange={(e) => set({ name: e.target.value }, "name")} />}</Field>
      <Field label="Duration" hint="Seconds. Transitions overlap the previous scene by half a second.">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={scene.durationInFrames / FPS}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value) * FPS);
              if (v >= S.durationInFrames.minValue! && v <= S.durationInFrames.maxValue!) set({ durationInFrames: v }, "dur");
            }}
          />
        )}
      </Field>
      <Field label="Layout" hint="Split puts text beside media in landscape; it stacks in portrait.">
        {() => <Segmented label="Layout" value={scene.layout} options={S.layout.options} onChange={(layout) => set({ layout })} />}
      </Field>
      <Field label="Background">{(id) => <Select id={id} value={scene.background} options={S.background.options} onChange={(background) => set({ background })} />}</Field>
      <Field label="Transition in">{(id) => <Select id={id} value={scene.transition} options={S.transition.options} onChange={(transition) => set({ transition })} />}</Field>
      <p className="text-[12px] leading-relaxed text-muted">Select a layer on the left to edit its content.</p>
    </>
  );
}

function LayerInspector({ layer }: { layer: Layer }) {
  const { scene, edit } = useEditor();
  const set = (patch: Partial<Layer>, key?: string) => edit(ops.updateLayer(scene.id, layer.id, patch), key && `${layer.id}:${key}`);
  const { label, icon: I } = LAYER_META[layer.type];

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent">
          <I size={15} />
        </span>
        <Heading>{label}</Heading>
      </div>

      {layer.type === "text" && (
        <>
          <Field label="Style">
            {(id) => <Select id={id} value={layer.role} options={textLayerSchema.shape.role.options} onChange={(role) => set({ role })} />}
          </Field>
          <Field label="Text" hint="Wrap words in *asterisks* to highlight them.">
            {(id) => <TextArea id={id} value={layer.text} onChange={(e) => set({ text: e.target.value }, "text")} />}
          </Field>
        </>
      )}

      {(layer.type === "badge" || layer.type === "cta") && (
        <Field label="Label">{(id) => <TextInput id={id} value={layer.text} onChange={(e) => set({ text: e.target.value }, "text")} />}</Field>
      )}
      {layer.type === "cta" && (
        <Field label="URL" hint="Shown under the button.">
          {(id) => <TextInput id={id} value={layer.url ?? ""} placeholder="yourproduct.com" onChange={(e) => set({ url: e.target.value || undefined }, "url")} />}
        </Field>
      )}

      {layer.type === "image" && (
        <>
          <Field label="Image URL">{(id) => <TextInput id={id} value={layer.src.startsWith("data:") ? "" : layer.src} placeholder="https://… (sample screenshot in use)" onChange={(e) => set({ src: e.target.value }, "src")} />}</Field>
          <Field label="Frame">{() => <Segmented label="Frame" value={layer.frame ?? "browser"} options={["none", "browser", "phone"] as const} onChange={(frame) => set({ frame })} />}</Field>
          <Field label="Size">{() => <Segmented label="Size" value={layer.size ?? "lg"} options={["sm", "md", "lg"] as const} onChange={(size) => set({ size })} />}</Field>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Slow zoom</span>
            <Toggle checked={!!layer.kenBurns} onChange={(kenBurns) => set({ kenBurns })} />
          </div>
        </>
      )}

      {layer.type === "list" && (
        <Field label="Items" hint="One per line, up to 6.">
          {(id) => (
            <TextArea
              id={id}
              rows={5}
              value={layer.items.join("\n")}
              onChange={(e) => {
                const items = e.target.value.split("\n").slice(0, 6);
                if (items.some((s) => s.trim())) set({ items }, "items");
              }}
            />
          )}
        </Field>
      )}

      {layer.type === "stat" && (
        <>
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
            <Field label="Prefix">{(id) => <TextInput id={id} value={layer.prefix ?? ""} placeholder="$" onChange={(e) => set({ prefix: e.target.value || undefined }, "prefix")} />}</Field>
            <Field label="Value">{(id) => <TextInput id={id} type="number" value={layer.value} onChange={(e) => set({ value: Number(e.target.value) || 0 }, "value")} />}</Field>
            <Field label="Suffix">{(id) => <TextInput id={id} value={layer.suffix ?? ""} placeholder="%" onChange={(e) => set({ suffix: e.target.value || undefined }, "suffix")} />}</Field>
          </div>
          <Field label="Label">{(id) => <TextInput id={id} value={layer.label} onChange={(e) => set({ label: e.target.value }, "label")} />}</Field>
        </>
      )}

      <div className="mt-1 border-t border-line pt-4">
        <Heading>Motion</Heading>
      </div>
      <Field label="Entrance">
        {(id) => (
          <Select
            id={id}
            value={layer.enter ?? "default"}
            options={["default", ...animationSchema.options]}
            onChange={(v) => set({ enter: v === "default" ? undefined : (v as Layer["enter"]) })}
          />
        )}
      </Field>
      <Field label="Delay" hint="Seconds after the scene starts. Leave empty to stagger automatically.">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            min={0}
            step={0.1}
            placeholder="auto"
            value={layer.delay === undefined ? "" : +(layer.delay / FPS).toFixed(2)}
            onChange={(e) => set({ delay: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) * FPS)) }, "delay")}
          />
        )}
      </Field>
    </>
  );
}

function ThemeInspector() {
  const { state, edit } = useEditor();
  const theme = state.project.theme;
  const set = (patch: Partial<Theme>, key?: string) => edit(ops.setProject({ theme: { ...theme, ...patch } }), key && `theme:${key}`);
  const colors: [keyof Theme, string][] = [
    ["background", "Background"],
    ["surface", "Surface"],
    ["text", "Text"],
    ["muted", "Muted text"],
    ["accent", "Accent"],
    ["accent2", "Secondary"],
  ];

  return (
    <>
      <Heading>Presets</Heading>
      <div className="grid grid-cols-3 gap-2">
        {THEME_PRESETS.map((p) => {
          const active = p.theme.background === theme.background && p.theme.accent === theme.accent;
          return (
            <button
              key={p.name}
              onClick={() => set(p.theme)}
              className={`press flex flex-col gap-1.5 rounded-xl p-1.5 text-left ${active ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-hover"}`}
            >
              <span className="relative flex h-10 items-end gap-1 overflow-hidden rounded-lg p-1.5 ring-1 ring-black/5" style={{ background: p.theme.background }}>
                <span className="h-2 w-5 rounded-full" style={{ background: p.theme.text }} />
                <span className="h-2 w-3 rounded-full" style={{ background: p.theme.accent }} />
                {active && <CheckIcon size={12} weight="bold" className="absolute top-1 right-1" style={{ color: p.theme.accent }} />}
              </span>
              <span className="px-0.5 text-[11px] font-medium">{p.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 border-t border-line pt-4">
        <Heading>Colors</Heading>
      </div>
      <div className="flex flex-col gap-1.5">
        {colors.map(([k, label]) => (
          <ColorField key={k} label={label} value={theme[k]} onChange={(v) => set({ [k]: v }, k)} />
        ))}
      </div>

      <div className="mt-1 border-t border-line pt-4">
        <Heading>Type</Heading>
      </div>
      <Field label="Headings">{(id) => <Select id={id} value={theme.headingFont} options={fontSchema.options} onChange={(headingFont) => set({ headingFont })} />}</Field>
      <Field label="Body">{(id) => <Select id={id} value={theme.bodyFont} options={fontSchema.options} onChange={(bodyFont) => set({ bodyFont })} />}</Field>
    </>
  );
}
