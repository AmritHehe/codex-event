"use client";

import { ArrowClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { memeTemplate, templateResponse } from "@/lib/distribution-contracts";
import { loadProject } from "./Kit";
import { downloadMeme, memeSvg } from "./meme";
import { Alert, SheetHead, Segmented, Working, field, label, mono, note, pad, primary } from "./ui";

type Template = z.infer<typeof memeTemplate>;
type Layout = "bands" | "right-panels";
type List = { status: "loading" | "done" | "error"; templates: Template[]; error?: string };

const imageResponse = z.object({ dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/) });
const layoutFor = (t?: Template): Layout => (t?.name.includes("Drake") ? "right-panels" : "bands");
const MAX = 80;

export function MemeSheet() {
  const [{ project, saved }] = useState(loadProject);
  const [list, setList] = useState<List>({ status: "loading", templates: [] });
  const [run, setRun] = useState(0);
  const [selected, setSelected] = useState("");
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState("");
  const [top, setTop] = useState("Building one more feature");
  const [bottom, setBottom] = useState("Remembering you still need to launch");
  const [layout, setLayout] = useState<Layout>("bands");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Imgflip's popular list, fetched through our server. Nothing from the project is sent.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/distribution/templates", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Popular templates are unavailable. Try again.");
        const { templates } = templateResponse.parse(await response.json());
        setList({ status: "done", templates });
        setSelected((current) => (templates.some((t) => t.id === current) ? current : (templates[0]?.id ?? "")));
        setLayout((current) => (run ? current : layoutFor(templates[0])));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setList({ status: "error", templates: [], error: e instanceof Error ? e.message : "Could not load templates." });
      });
    return () => controller.abort();
  }, [run]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/distribution/templates?id=${encodeURIComponent(selected)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) })
      .then(async (r) => {
        if (!r.ok) throw new Error("Template image could not be loaded.");
        return imageResponse.parse(await r.json());
      })
      .then(({ dataUrl }) => {
        setImage(dataUrl);
        setImageError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setImage("");
          setImageError(e instanceof Error ? e.message : "Could not load template.");
        }
      });
    return () => controller.abort();
  }, [selected]);

  const refresh = () => {
    setList((l) => ({ ...l, status: "loading", error: undefined }));
    setRun((n) => n + 1);
  };
  const pick = (t: Template) => {
    if (t.id === selected) return;
    setImage("");
    setImageError("");
    setSelected(t.id);
    setLayout(layoutFor(t));
  };
  const download = async () => {
    setExporting(true);
    setExportError("");
    try {
      await downloadMeme(svg);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "PNG export failed.");
    } finally {
      setExporting(false);
    }
  };

  const current = list.templates.find((t) => t.id === selected);
  const svg = image ? memeSvg(image, top, bottom, project, layout) : "";

  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <SheetHead slug="TRK 03 · Meme agent" title="Meme composer">
        Pick a popular template, write two captions, and export a 1080 × 1080 PNG signed with{" "}
        <span className="text-ink">{project.name}</span>
        {saved ? "" : ", the sample project"} in its accent.
      </SheetHead>

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-6 md:self-start">
          <figure className="relative aspect-square overflow-hidden rounded-[10px] border border-line bg-canvas">
            {svg ? (
              // The composed SVG as a data URL: next/image cannot optimize it, and the canvas export draws this same markup.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`Meme preview: ${top} / ${bottom}`} className="size-full" />
            ) : (
              <div className="grid size-full place-items-center p-8">
                {imageError ? (
                  <Alert title="This template did not load.">{imageError} Pick another one.</Alert>
                ) : list.status === "error" ? (
                  <p className="text-center text-[14px] text-muted">Templates are needed for a preview.</p>
                ) : (
                  <div className="w-40">
                    <Working>{list.status === "loading" ? "Loading templates" : "Loading image"}</Working>
                  </div>
                )}
              </div>
            )}
          </figure>
          <p className={`${label} flex justify-between gap-4`}>
            <span className="shrink-0">1080 × 1080 · PNG</span>
            <span className="truncate">{current?.name ?? ""}</span>
          </p>
          <button onClick={download} disabled={!svg || exporting} className={`${primary} flex items-center justify-center gap-2`}>
            <DownloadSimpleIcon size={16} />
            {exporting ? "Exporting" : "Download PNG"}
          </button>
          {exportError && <Alert title="The PNG could not be exported.">{exportError}</Alert>}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {(
            [
              ["Top caption", top, setTop],
              ["Bottom caption", bottom, setBottom],
            ] as const
          ).map(([name, value, set]) => (
            <label key={name} className="flex flex-col gap-2">
              <span className={`${label} flex justify-between`}>
                <span>{name}</span>
                <span>
                  {pad(value.length)} / {MAX}
                </span>
              </span>
              <input value={value} maxLength={MAX} onChange={(e) => set(e.target.value)} style={{ outline: "none" }} className={field} />
            </label>
          ))}

          <div className="flex flex-col gap-2">
            <span className={label}>Caption placement</span>
            <Segmented
              name="Caption placement"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "bands", label: "Top and bottom" },
                { value: "right-panels", label: "Right panels" },
              ]}
            />
          </div>

          <section aria-labelledby="meme-templates" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
              <h3 id="meme-templates" className={label}>
                Templates{list.status === "done" && ` · ${pad(list.templates.length)}`} · Imgflip popular
              </h3>
              <button onClick={refresh} disabled={list.status === "loading"} className={`${mono} press flex h-7 items-center gap-1.5 rounded-md px-1.5 text-ink hover:bg-hover disabled:text-faint`}>
                <ArrowClockwiseIcon size={13} />
                Refresh
              </button>
            </div>

            {list.status === "error" && (
              <div className="flex flex-col items-start gap-3 py-2">
                <Alert title="Templates did not load.">{list.error}</Alert>
                <button onClick={refresh} className="press h-9 rounded-md bg-ink px-4 text-[14px] font-medium text-canvas">
                  Try again
                </button>
              </div>
            )}
            {list.status === "done" && !list.templates.length && <p className="py-6 text-[14px] text-muted">Imgflip returned no templates. Refresh to try again.</p>}
            {list.status === "loading" && !list.templates.length && (
              <div aria-hidden className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="aspect-square rounded-[6px] border border-line bg-canvas" />
                ))}
              </div>
            )}
            {list.templates.length > 0 && (
              <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
                {list.templates.map((t, i) => {
                  const on = t.id === selected;
                  return (
                    <li key={t.id} className="min-w-0">
                      <button onClick={() => pick(t)} aria-pressed={on} title={t.name} className="group flex w-full min-w-0 flex-col gap-1.5 text-left">
                        <span
                          className={`relative block aspect-square w-full overflow-hidden rounded-[6px] border bg-canvas transition-colors duration-150 ${on ? "border-accent ring-1 ring-accent" : "border-line group-hover:border-ink"}`}
                        >
                          {/* Remote thumbnails from i.imgflip.com; the composer itself only uses the proxied data URL. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                          <span className={`${mono} absolute top-1 left-1 rounded-[3px] bg-panel/90 px-1 ${on ? "text-accent" : "text-ink"}`}>{pad(i + 1)}</span>
                        </span>
                        <span className={`truncate text-[12px] leading-tight ${on ? "font-medium text-ink" : "text-muted group-hover:text-ink"}`}>{t.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className={note}>
            Ranked by{" "}
            <a href="https://imgflip.com/memetemplates" target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">
              Imgflip&apos;s popularity feed
            </a>
            , not a claim about global trends. Captions and export stay in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
