"use client";
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";
import { communityDraft } from "@/lib/distribution-contracts";
import type { Project } from "@/video/schema";

const key = "shipcast:community-drafts";
type Draft = z.infer<typeof communityDraft>;
const names = { reddit: "Reddit", "product-hunt": "Product Hunt", "hacker-news": "Hacker News prep" };

export function CommunityQueue({ project }: { project: Project }) {
  const [drafts, replace] = useReducer((_old: Draft[], next: Draft[]) => next, []);
  const [ready, markReady] = useReducer(() => true, false);
  const [channel, setChannel] = useState<Draft["channel"]>("reddit");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) replace(z.array(communityDraft).parse(JSON.parse(raw))); }
    catch { /* unavailable or corrupt browser storage */ }
    markReady();
  }, []);
  function update(next: Draft[]) {
    replace(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { setNotice("Browser storage is unavailable. Copy your drafts before leaving."); }
  }
  function patch(id: string, data: Partial<Draft>) { update(drafts.map((d) => d.id === id ? { ...d, ...data } : d)); }
  return (
    <div className="space-y-4 py-6">
      <h3 className="text-[20px] font-semibold tracking-tight">Community launch queue</h3>
      <p className="max-w-2xl text-[14px] text-muted">Keep drafts here for review and manual submission. HN prep starts blank so you can write it yourself. Nothing in this queue is posted automatically.</p>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="community-channel">Community</label>
        <select id="community-channel" value={channel} onChange={(e) => setChannel(e.target.value as Draft["channel"])} className="rounded-md border border-line bg-panel px-3 py-2 text-[13px]">{Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <button disabled={!ready} onClick={() => update([...drafts, { id: crypto.randomUUID(), channel, text: "", status: "draft", projectName: project.name }])} className="press rounded-md border border-line px-3 py-2 text-[13px]">Add draft</button>
      </div>
      {notice && <p role="status" className="text-[13px]">{notice}</p>}
      <div className="divide-y divide-line border-t border-line">
        {drafts.map((draft, i) => (
          <article key={draft.id} className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[14px] font-medium">{names[draft.channel]} · {draft.projectName}</h4>
              <label className="text-[12px]">Status<select aria-label={`Draft ${i + 1} status`} value={draft.status} onChange={(e) => patch(draft.id, { status: e.target.value as Draft["status"] })} className="ml-2 rounded-md border border-line bg-panel p-1.5"><option value="draft">Draft</option><option value="ready">Ready for manual submission</option><option value="done">Submitted manually</option></select></label>
            </div>
            <label className="sr-only" htmlFor={draft.id}>{names[draft.channel]} draft {i + 1}</label>
            <textarea id={draft.id} value={draft.text} onChange={(e) => patch(draft.id, { text: e.target.value })} maxLength={20_000} rows={4} placeholder={draft.channel === "hacker-news" ? "Write your own title and submission checklist" : "Paste your draft, then review it for this community"} className="w-full rounded-md border border-line bg-panel p-3 text-[14px]" />
            <div className="flex gap-4 text-[13px]">
              <button onClick={() => navigator.clipboard.writeText(draft.text).then(() => setNotice("Draft copied."), () => setNotice("Clipboard is blocked. Select the text and copy manually."))} className="underline">Copy draft</button>
              <button onClick={() => update(drafts.filter((d) => d.id !== draft.id))} className="text-muted hover:text-ink">Remove draft</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
