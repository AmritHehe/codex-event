"use client";

import { CheckIcon, DownloadSimpleIcon, ExportIcon, WarningIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { postJson, RENDER_URL, renderJob } from "@/lib/contracts";
import { ASPECTS, aspectSchema, FPS, type Aspect } from "@/video/schema";
import { useEditor } from "./store";
import { Button, cx, Label, POP, useDismiss } from "./ui";

type RenderJob = z.infer<typeof renderJob>;
type Row = { aspect: Aspect; job: RenderJob | null; error: string | null };

const NAMES: Record<Aspect, string> = { "16:9": "Landscape", "9:16": "Vertical", "1:1": "Square" };
const live = (r: Row) => !r.error && (!r.job || r.job.status === "queued" || r.job.status === "rendering");
const message = (e: unknown) => (e instanceof z.ZodError ? "Render server sent an unexpected response." : e instanceof Error ? e.message : "Render failed.");

/** F4.1: one render job per picked format, polled every second. */
export function ExportMenu() {
  const { state } = useEditor();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Aspect[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [offline, setOffline] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, useCallback(() => setOpen(false), []));

  const patch = (aspect: Aspect, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.aspect === aspect ? { ...r, ...p } : r)));
  const busy = rows.some(live);

  const start = () => {
    const project = state.project;
    setOffline(false);
    setRows(picked.map((aspect) => ({ aspect, job: null, error: null })));
    for (const aspect of picked) {
      postJson(`${RENDER_URL}/render`, { project: { ...project, aspect } }, renderJob)
        .then((job) => patch(aspect, { job }))
        .catch((e) => {
          if (e instanceof TypeError) setOffline(true);
          patch(aspect, { error: e instanceof TypeError ? "Not started" : message(e) });
        });
    }
  };

  // Poll running jobs once a second; each update re-arms the timer.
  useEffect(() => {
    const running = rows.filter((r) => r.job && live(r));
    if (!running.length) return;
    const t = setTimeout(() => {
      for (const { aspect, job } of running) {
        fetch(`${RENDER_URL}/render/${job!.jobId}`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`Status check failed (${res.status})`);
            patch(aspect, { job: renderJob.parse(await res.json()) });
          })
          .catch((e) => patch(aspect, { error: e instanceof TypeError ? `Lost connection to ${RENDER_URL}` : message(e) }));
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [rows]);

  const progress = rows.length ? rows.reduce((s, r) => s + (r.job?.progress ?? 0), 0) / rows.length : 0;

  return (
    <div ref={ref} className="relative">
      <Button
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open && !busy) setPicked([state.project.aspect]);
          setOpen((o) => !o);
        }}
      >
        <ExportIcon size={14} />
        <span className="max-sm:hidden">Export</span>
        {busy && <span className="font-mono text-[10.5px] text-accent tabular-nums">{Math.round(progress * 100)}%</span>}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Export video"
            {...POP}
            style={{ transformOrigin: "top right" }}
            className="absolute top-9 right-0 z-40 w-[min(340px,calc(100vw-24px))] rounded-[10px] border border-line bg-panel shadow-pop"
          >
            <div className="flex h-9 items-center justify-between border-b border-line px-3">
              <Label className="text-ink">Export</Label>
              <span className="font-mono text-[10.5px] text-muted uppercase">MP4 · {FPS} fps</span>
            </div>

            <fieldset className="flex flex-col p-1.5" disabled={busy}>
              <legend className="sr-only">Formats</legend>
              {aspectSchema.options.map((a) => {
                const on = picked.includes(a);
                const { width, height } = ASPECTS[a];
                return (
                  <label key={a} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-1.5 hover:bg-hover/60 has-[:disabled]:cursor-default has-[:disabled]:opacity-50">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      onChange={() => setPicked((p) => (on ? p.filter((x) => x !== a) : aspectSchema.options.filter((x) => x === a || p.includes(x))))}
                    />
                    <span aria-hidden className={cx("grid size-3.5 place-items-center rounded-[3px] border peer-focus-visible:outline-2 peer-focus-visible:outline-accent", on ? "border-ink bg-ink text-canvas" : "border-[#cfcfcb] bg-white")}>
                      {on && <CheckIcon size={9} weight="bold" />}
                    </span>
                    <span
                      aria-hidden
                      className="grid w-6 shrink-0 place-items-center"
                    >
                      <span className="block rounded-[2px] border border-muted" style={{ aspectRatio: `${width} / ${height}`, height: width > height ? 10 : 16 }} />
                    </span>
                    <span className="font-mono text-[12px] tabular-nums">{a}</span>
                    <span className="text-[12px] text-muted">{NAMES[a]}</span>
                    {a === state.project.aspect && <span className="rounded-[3px] bg-hover px-1 font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">Current</span>}
                    <span className="ml-auto font-mono text-[10.5px] text-faint tabular-nums">
                      {width} × {height}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="px-3 pb-3">
              <Button variant="primary" className="w-full" disabled={!picked.length || busy} onClick={start}>
                {busy ? "Rendering" : picked.length ? `Render ${picked.length} format${picked.length > 1 ? "s" : ""}` : "Pick a format"}
              </Button>
            </div>

            {offline && (
              <div role="alert" className="mx-3 mb-3 flex gap-2 rounded-md border border-line bg-canvas p-2.5 text-[12px] leading-snug">
                <WarningIcon size={14} weight="fill" className="mt-px shrink-0 text-accent" />
                <p>
                  <span className="font-medium">Render server not running on {RENDER_URL}.</span>{" "}
                  <span className="text-muted">
                    Start it with <code className="font-mono text-[11px] text-ink">pnpm render-server</code> and try again.
                  </span>
                </p>
              </div>
            )}

            {rows.length > 0 && !offline && (
              <ul aria-label="Render jobs" className="flex flex-col gap-2.5 border-t border-line px-3 py-3">
                {rows.map((r) => (
                  <JobRow key={r.aspect} row={r} />
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRow({ row: { aspect, job, error } }: { row: Row }) {
  const p = job?.progress ?? 0;
  const status = error ? "Error" : !job ? "Starting" : job.status === "rendering" ? `${Math.round(p * 100)}%` : job.status;
  const failed = !!error || job?.status === "error";
  const done = job?.status === "done" && job.url;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
        <span className="text-ink">{aspect}</span>
        <span className={cx("uppercase", failed ? "text-accent" : "text-muted")}>{status}</span>
        {done && (
          <a href={new URL(job.url!, RENDER_URL).href} download className="ml-auto inline-flex items-center gap-1 font-sans text-[12px] font-medium text-ink underline-offset-2 hover:underline">
            <DownloadSimpleIcon size={12} />
            Download
          </a>
        )}
      </div>
      {/* Progress as a track: hairline lane, ink fill, orange head. */}
      <div className="relative h-1.5 overflow-hidden rounded-[2px] border border-line bg-canvas" role="progressbar" aria-label={`${aspect} render`} aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="absolute inset-y-0 left-0 w-full origin-left bg-ink/80 transition-transform duration-700 ease-linear motion-reduce:transition-none" style={{ transform: `scaleX(${p})` }} />
        {!failed && !done && (
          <div className="absolute inset-0 transition-transform duration-700 ease-linear motion-reduce:transition-none" style={{ transform: `translateX(${p * 100}%)` }}>
            <div className="h-full w-px bg-accent" />
          </div>
        )}
      </div>
      {(error || job?.error) && <p className="text-[11.5px] leading-snug text-muted">{error ?? job?.error}</p>}
    </li>
  );
}
