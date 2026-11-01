"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { generateRequest, generateResponse } from "@/lib/contracts";
import { saveProject } from "@/lib/project-storage";
import { useApiTask } from "@/lib/use-api-task";
import type { Project } from "@/video/schema";

export function GenerateForm({ onGenerated, compact = false }: { onGenerated?: (project: Project) => void; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const inputId = useId();
  const { busy, error, setError, run, cancel } = useApiTask();
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = generateRequest.safeParse({ url: url.trim() });
    if (!input.success || !/^https?:\/\//i.test(url.trim())) { setError("Enter a full http or https product URL."); return; }
    const result = await run("/api/generate", input.data, generateResponse);
    if (!result) return;
    if (onGenerated) onGenerated(result.project);
    else {
      try { saveProject(result.project); }
      catch { setError("Browser storage is unavailable. Open Studio and generate there to keep editing."); return; }
      router.push("/studio");
    }
  }

  return (
    <form onSubmit={submit} aria-label="Generate launch video" className={compact ? "border-b border-line bg-panel px-4 py-3" : "mt-8 max-w-2xl border-y border-line py-5"}>
      <label htmlFor={inputId} className="mb-2 block font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
        {compact ? "New video from URL" : "Start with your product URL"}
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={inputId} type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-product.com" disabled={busy}
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-[14px] disabled:opacity-60" />
        <button type="submit" disabled={busy} className="press h-10 rounded-md bg-ink px-4 text-[13px] font-medium text-white disabled:opacity-60">
          {busy ? "Generating…" : "Generate video"}
        </button>
      </div>
      {busy && (
        <div role="status" className="mt-3">
          <div className="relative flex border-y border-line py-2 font-mono text-[10px] tracking-wide text-muted uppercase">
            <span className="flex-1 border-r border-line px-2">Read product</span>
            <span className="flex-1 border-r border-line px-2">Write scenes</span>
            <span className="flex-1 px-2">Build layers</span>
            <span aria-hidden className="absolute top-0 bottom-0 left-0 w-px animate-pulse bg-accent motion-reduce:animate-none" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span>Creating your draft. This may take up to two minutes.</span>
            <button type="button" onClick={cancel} className="text-ink underline">Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] text-ink">{error}</p>}
    </form>
  );
}
