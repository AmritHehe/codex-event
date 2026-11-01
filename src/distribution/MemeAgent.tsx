"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { memeTemplate, templateResponse } from "@/lib/distribution-contracts";
import type { Project } from "@/video/schema";
import { downloadMeme, memeSvg } from "./meme";

export function MemeAgent({ project }: { project: Project }) {
  const [templates, setTemplates] = useState<z.infer<typeof memeTemplate>[]>([]);
  const [selected, setSelected] = useState("");
  const [image, setImage] = useState("");
  const [top, setTop] = useState("Building one more feature");
  const [bottom, setBottom] = useState("Remembering you still need to launch");
  const [layout, setLayout] = useState<"bands" | "right-panels">("bands");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/distribution/templates", { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error("Popular templates are unavailable. Try again.");
      const { templates } = templateResponse.parse(await response.json());
      setTemplates(templates); setSelected(templates[0]?.id ?? "");
      setLayout(templates[0]?.name.includes("Drake") ? "right-panels" : "bands");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load templates."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/distribution/templates?id=${encodeURIComponent(selected)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) })
      .then(async (r) => { if (!r.ok) throw new Error("Template image could not be loaded."); return z.object({ dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/) }).parse(await r.json()); })
      .then(({ dataUrl }) => { setImage(dataUrl); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) { setImage(""); setError(e instanceof Error ? e.message : "Could not load template."); } });
    return () => controller.abort();
  }, [selected]);
  const svg = image ? memeSvg(image, top, bottom, project, layout) : "";
  return (
    <div className="grid gap-6 py-6 md:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-[20px] font-semibold tracking-tight">Meme agent</h3>
        <p className="text-[14px] text-muted">Pick a popular template, edit its caption layers, and add your project&apos;s name and accent. Export a 1080 × 1080 PNG.</p>
        <button onClick={load} disabled={busy} className="press rounded-md border border-line px-3 py-2 text-[13px] disabled:opacity-50">{busy ? "Loading templates…" : templates.length ? "Refresh popular templates" : "Load popular templates"}</button>
        {!!templates.length && <label className="block text-[13px]">Template<select value={selected} onChange={(e) => { setImage(""); setSelected(e.target.value); setLayout(templates.find((t) => t.id === e.target.value)?.name.includes("Drake") ? "right-panels" : "bands"); }} className="mt-1 block w-full rounded-md border border-line bg-panel p-2">{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <label className="block text-[13px]">Caption placement<select value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)} className="mt-1 block w-full rounded-md border border-line bg-panel p-2"><option value="bands">Top and bottom</option><option value="right-panels">Right panels</option></select></label>
        <label className="block text-[13px]">Top caption<input value={top} maxLength={80} onChange={(e) => setTop(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-panel p-2" /></label>
        <label className="block text-[13px]">Bottom caption<input value={bottom} maxLength={80} onChange={(e) => setBottom(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-panel p-2" /></label>
        <button disabled={!svg} onClick={() => downloadMeme(svg).catch((e: Error) => setError(e.message))} className="press rounded-md bg-ink px-4 py-2 text-[13px] text-canvas disabled:opacity-40">Download PNG</button>
        <p className="text-[12px] text-muted">Templates from <a href="https://imgflip.com/memetemplates" target="_blank" rel="noreferrer" className="underline">Imgflip</a>. Captions stay in your browser.</p>
        {error && <p role="alert" className="text-[13px]">{error}</p>}
      </div>
      <div className="aspect-square overflow-hidden rounded-[10px] border border-line bg-panel">
        {/* Embedded SVG is exported by canvas; next/image cannot optimize data URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Meme preview with your product layer" className="h-full w-full" /> : <div className="grid h-full place-items-center p-6 text-center text-[14px] text-muted">Load a template to preview your still composition.</div>}
      </div>
    </div>
  );
}
