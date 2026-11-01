"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { THEME_PRESETS } from "@/video/themes";
import { animationSchema, fontSchema, FPS, sceneSchema, sceneStarts, textLayerSchema, TRANSITION_FRAMES, type Layer, type Scene, type Theme } from "@/video/schema";
import { LAYER_META, pad2 } from "./Panels";
import { enterFrame, ops, useEditor } from "./store";
import { ColorField, cx, Field, Section, Segmented, Select, tc, TextArea, TextInput, Toggle } from "./ui";

const TABS = [
  { id: "edit", label: "Properties" },
  { id: "theme", label: "Theme" },
] as const;

export function Inspector() {
  const [tab, setTab] = useState<"edit" | "theme">("edit");
  const { layer } = useEditor();
  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Inspector" className="sticky top-0 z-10 flex h-9 items-stretch gap-4 border-b border-line bg-panel px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "relative text-[12px] font-medium transition-colors duration-150",
              tab === t.id ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "theme" ? <ThemeInspector /> : layer ? <LayerInspector layer={layer} /> : <SceneInspector />}
    </div>
  );
}

function SceneInspector() {
  const { state, scene, edit } = useEditor();
  const set = (patch: Partial<Scene>, key?: string) => edit(ops.updateScene(scene.id, patch), key && `${scene.id}:${key}`);
  const S = sceneSchema.shape;
  const i = state.project.scenes.indexOf(scene);
  const start = sceneStarts(state.project)[i];
  return (
    <>
      <Section title="Scene" meta={`SCN ${pad2(i + 1)}`}>
        <Field label="Name">{(id) => <TextInput id={id} value={scene.name} onChange={(e) => set({ name: e.target.value }, "name")} />}</Field>
        <Field label="Duration" hint={`${scene.durationInFrames} frames. Transitions overlap the previous scene by ${TRANSITION_FRAMES} frames.`}>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              unit="s"
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
        <dl className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
          <dt className="font-sans text-[12px] text-muted">In</dt>
          <dd>{tc(start)}</dd>
          <dt className="font-sans text-[12px] text-muted">Out</dt>
          <dd>{tc(start + scene.durationInFrames)}</dd>
        </dl>
      </Section>
      <Section title="Look">
        <Field label="Layout" hint="Split puts text beside media in landscape. It stacks in portrait.">
          {() => <Segmented label="Layout" value={scene.layout} options={S.layout.options} onChange={(layout) => set({ layout })} />}
        </Field>
        <Field label="Background">{(id) => <Select id={id} value={scene.background} options={S.background.options} onChange={(background) => set({ background })} />}</Field>
        <Field label="Transition">{(id) => <Select id={id} value={scene.transition} options={S.transition.options} onChange={(transition) => set({ transition })} />}</Field>
      </Section>
      <p className="px-3 py-3 text-[12px] leading-relaxed text-muted">Select a layer to edit its content.</p>
    </>
  );
}

function LayerInspector({ layer }: { layer: Layer }) {
  const { state, scene, edit } = useEditor();
  const set = (patch: Partial<Layer>, key?: string) => edit(ops.updateLayer(scene.id, layer.id, patch), key && `${layer.id}:${key}`);
  const { label, icon: I } = LAYER_META[layer.type];
  const li = scene.layers.indexOf(layer);
  const si = state.project.scenes.indexOf(scene);
  const enter = enterFrame(scene, layer.id);

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-3 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-white/70">
          <I size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] leading-tight font-medium">{label}</p>
          <p className="font-mono text-[10.5px] text-muted tabular-nums">
            SCN {pad2(si + 1)} / L{li + 1} · {layer.id}
          </p>
        </div>
      </div>

      <Section title="Content">
        {layer.type === "text" && (
          <>
            <Field label="Style">{(id) => <Select id={id} value={layer.role} options={textLayerSchema.shape.role.options} onChange={(role) => set({ role })} />}</Field>
            <Field stack label="Text" hint="Wrap words in *asterisks* to highlight them.">
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
            <Field stack label="Image URL" hint={layer.src.startsWith("data:") ? "Sample screenshot in use." : undefined}>
              {(id) => <TextInput id={id} value={layer.src.startsWith("data:") ? "" : layer.src} placeholder="https://" onChange={(e) => set({ src: e.target.value }, "src")} />}
            </Field>
            <Field label="Frame">{() => <Segmented label="Frame" value={layer.frame ?? "browser"} options={["none", "browser", "phone"] as const} onChange={(frame) => set({ frame })} />}</Field>
            <Field label="Size">{() => <Segmented label="Size" value={layer.size ?? "lg"} options={["sm", "md", "lg"] as const} onChange={(size) => set({ size })} />}</Field>
            <Field label="Slow zoom">{(id) => <Toggle id={id} checked={!!layer.kenBurns} onChange={(kenBurns) => set({ kenBurns })} />}</Field>
          </>
        )}

        {layer.type === "list" && (
          <Field stack label="Items" hint="One per line, up to 6.">
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
            <Field label="Value">{(id) => <TextInput id={id} type="number" value={layer.value} onChange={(e) => set({ value: Number(e.target.value) || 0 }, "value")} />}</Field>
            <Field label="Prefix">{(id) => <TextInput id={id} value={layer.prefix ?? ""} placeholder="$" onChange={(e) => set({ prefix: e.target.value || undefined }, "prefix")} />}</Field>
            <Field label="Suffix">{(id) => <TextInput id={id} value={layer.suffix ?? ""} placeholder="%" onChange={(e) => set({ suffix: e.target.value || undefined }, "suffix")} />}</Field>
            <Field label="Label">{(id) => <TextInput id={id} value={layer.label} onChange={(e) => set({ label: e.target.value }, "label")} />}</Field>
          </>
        )}
      </Section>

      <Section title="Motion" meta={enter === null ? "Hidden" : `In ${tc(enter)}`}>
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
        <Field label="Delay" hint="Seconds after the scene starts. Empty staggers by layer order.">
          {(id) => (
            <TextInput
              id={id}
              type="number"
              unit="s"
              min={0}
              step={0.1}
              placeholder="auto"
              value={layer.delay === undefined ? "" : +(layer.delay / FPS).toFixed(2)}
              onChange={(e) => set({ delay: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) * FPS)) }, "delay")}
            />
          )}
        </Field>
      </Section>
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
    ["muted", "Muted"],
    ["accent", "Accent"],
    ["accent2", "Secondary"],
  ];

  return (
    <>
      <Section title="Presets" meta={String(THEME_PRESETS.length).padStart(2, "0")}>
        <div className="grid grid-cols-3 gap-1.5">
          {THEME_PRESETS.map((p) => {
            const active = p.theme.background === theme.background && p.theme.accent === theme.accent;
            return (
              <button
                key={p.name}
                aria-pressed={active}
                onClick={() => set(p.theme)}
                className={cx("press flex flex-col gap-1 rounded-md border p-1 text-left", active ? "border-ink" : "border-line hover:border-[#cfcfcb]")}
              >
                <span className="relative flex h-9 flex-col justify-end gap-1 overflow-hidden rounded-[3px] p-1.5" style={{ background: p.theme.background }}>
                  <span className="h-1 w-6 rounded-[1px]" style={{ background: p.theme.text }} />
                  <span className="flex gap-0.5">
                    <span className="h-1 w-3 rounded-[1px]" style={{ background: p.theme.accent }} />
                    <span className="h-1 w-2 rounded-[1px]" style={{ background: p.theme.accent2 }} />
                  </span>
                  {active && <CheckIcon size={10} weight="bold" className="absolute top-1 right-1" style={{ color: p.theme.text }} />}
                </span>
                <span className="px-0.5 text-[11px] font-medium">{p.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Colors">
        {colors.map(([k, label]) => (
          <ColorField key={k} label={label} value={theme[k]} onChange={(v) => set({ [k]: v }, k)} />
        ))}
      </Section>

      <Section title="Type">
        <Field label="Headings">{(id) => <Select id={id} value={theme.headingFont} options={fontSchema.options} onChange={(headingFont) => set({ headingFont })} />}</Field>
        <Field label="Body">{(id) => <Select id={id} value={theme.bodyFont} options={fontSchema.options} onChange={(bodyFont) => set({ bodyFont })} />}</Field>
      </Section>
    </>
  );
}
