"use client";

import Link from "next/link";
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";
import { kitResponse } from "@/lib/contracts";
import { KIT_CHANNELS } from "@/lib/kit-channels";
import { PROJECT_STORAGE_KEY, readProject } from "@/lib/project-storage";
import { useApiTask } from "@/lib/use-api-task";
import type { Project } from "@/video/schema";

const DRAFT_KEY = "shipcast:kit";
const draftSchema = z.object({ source: z.string(), posts: kitResponse.shape.posts });
type Drafts = z.infer<typeof draftSchema>;
type State = { ready: boolean; project: Project | null; drafts: Drafts | null };
type Action = { type: "restore"; project: Project | null; drafts: Drafts | null } | { type: "drafts"; drafts: Drafts } | { type: "project"; project: Project | null };

function reducer(state: State, action: Action): State {
  if (action.type === "restore") return { ready: true, project: action.project, drafts: action.drafts };
  if (action.type === "project") return { ...state, project: action.project };
  return { ...state, drafts: action.drafts };
}

export function KitPanel() {
  const [state, dispatch] = useReducer(reducer, { ready: false, project: null, drafts: null });
  const [channels, setChannels] = useState<string[]>(["x", "linkedin-personal", "product-hunt"]);
  const [notice, setNotice] = useState("");
  const { busy, error, run, cancel } = useApiTask();

  useEffect(() => {
    let drafts: Drafts | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      drafts = raw ? draftSchema.parse(JSON.parse(raw)) : null;
    } catch { /* corrupt or unavailable storage */ }
    dispatch({ type: "restore", project: readProject(), drafts });
    const sync = () => dispatch({ type: "project", project: readProject() });
    const storage = (event: StorageEvent) => { if (!event.key || event.key === PROJECT_STORAGE_KEY) sync(); };
    window.addEventListener("focus", sync);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("focus", sync); window.removeEventListener("storage", storage); };
  }, []);

  function updateDrafts(drafts: Drafts) {
    dispatch({ type: "drafts", drafts });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); }
    catch { setNotice("Drafts are editable, but browser storage is unavailable. Copy them before leaving."); }
  }

  async function generate() {
    if (!state.project || !channels.length) return;
    setNotice("");
    const source = JSON.stringify(state.project);
    const result = await run("/api/kit", { project: state.project, channels }, kitResponse);
    if (result) updateDrafts({ source, posts: result.posts.map((p) => ({ channelId: p.channelId, text: [p.text, p.hashtags?.join(" ")].filter(Boolean).join("\n\n") })) });
  }

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setNotice(`${label} copied.`); }
    catch { setNotice("Clipboard access was blocked. Select the draft text and copy it manually."); }
  }

  const stale = state.drafts && state.drafts.source !== JSON.stringify(state.project);

  return (
    <section aria-labelledby="kit-title" className="border-y border-line py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Copy agent</p>
          <h2 id="kit-title" className="text-[22px] font-semibold tracking-tight">Your launch kit</h2>
        </div>
        {state.project && <p className="text-[13px] text-muted">From {state.project.name}</p>}
      </div>
      {!state.ready ? <p role="status" className="mt-4 text-[14px] text-muted">Loading your project…</p> : !state.project ? (
        <p className="mt-4 text-[14px] text-muted">Save a project in <Link href="/studio" className="text-ink underline">Studio</Link> to generate channel drafts.</p>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-muted">Choose channels, then edit and copy your drafts.</p>
          <fieldset disabled={busy} className="mt-4 flex flex-wrap gap-2">
            <legend className="sr-only">Kit channels</legend>
            {KIT_CHANNELS.map((channel) => (
              <label key={channel.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[13px]">
                <input type="checkbox" checked={channels.includes(channel.id)} onChange={(e) => setChannels((ids) => e.target.checked ? [...ids, channel.id] : ids.filter((id) => id !== channel.id))} className="accent-ink" />
                {channel.label}
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={generate} disabled={busy || !channels.length} className="press h-10 rounded-md bg-ink px-4 text-[13px] font-medium text-white disabled:opacity-50">
              {busy ? "Writing drafts…" : state.drafts ? "Regenerate selected drafts" : "Generate drafts"}
            </button>
            {busy && <button onClick={cancel} className="text-[13px] underline">Cancel</button>}
            <span className="text-[12px] text-muted">Drafts only. Nothing is posted.</span>
          </div>
          {busy && <p role="status" className="mt-3 text-[13px] text-muted">Adapting your project for {channels.length} channels…</p>}
        </>
      )}
      {error && <p role="alert" className="mt-3 text-[13px]">{error}</p>}
      {notice && <p role="status" className="mt-3 text-[13px]">{notice}</p>}
      {stale && <p className="mt-4 border-l-2 border-accent pl-3 text-[13px]">These drafts are from an earlier project version. Regenerate to use the latest video.</p>}
      {state.drafts && (
        <div className="mt-5 divide-y divide-line border-t border-line">
          {state.drafts.posts.map((post, index) => {
            const label = KIT_CHANNELS.find((c) => c.id === post.channelId)?.label ?? post.channelId;
            return (
              <article key={post.channelId} className="py-4">
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor={`draft-${post.channelId}`} className="text-[14px] font-semibold">{label}</label>
                  <button onClick={() => copy(post.text, label)} className="press rounded-md border border-line px-3 py-1.5 text-[12px] hover:bg-hover">Copy draft</button>
                </div>
                <textarea id={`draft-${post.channelId}`} value={post.text} rows={post.channelId === "product-hunt" ? 2 : 6} onChange={(e) => updateDrafts({ ...state.drafts!, posts: state.drafts!.posts.map((p, i) => i === index ? { ...p, text: e.target.value } : p) })}
                  className="w-full resize-y rounded-md border border-line bg-panel p-3 text-[14px] leading-relaxed" />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
