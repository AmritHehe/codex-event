"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";
import { communityDraft } from "@/lib/distribution-contracts";
import { CHANNELS } from "./channels";
import { ChannelLogo } from "./icons";
import { loadProject } from "./Kit";
import { SheetHead, Segmented, label, mono, note, pad, small } from "./ui";

const STORAGE = "shipcast:community-drafts";
type Draft = z.infer<typeof communityDraft>;
export type Community = Draft["channel"];
const NAMES: Record<Community, string> = { reddit: "Reddit", "product-hunt": "Product Hunt", "hacker-news": "Hacker News prep" };
const ORDER = Object.keys(NAMES) as Community[];
const STATUS: { value: Draft["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "done", label: "Submitted" },
];
const BYID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
export const isCommunity = (id: string): id is Community => id in NAMES;

/** Queue entries persist in this browser only. Nothing here is ever posted automatically. */
export function useCommunityQueue() {
  const [drafts, replace] = useReducer((_old: Draft[], next: Draft[]) => next, []);
  const [ready, markReady] = useReducer(() => true, false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) replace(z.array(communityDraft).parse(JSON.parse(raw)));
    } catch {
      // unavailable or corrupt browser storage
    }
    markReady();
  }, []);

  function update(next: Draft[]) {
    replace(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      setNotice("Browser storage is unavailable. Copy your drafts before leaving.");
    }
  }
  /** Hacker News bans AI-written posts, so its entries always start blank whatever text is offered. */
  function add(channel: Community, text = "") {
    const id = crypto.randomUUID();
    update([...drafts, { id, channel, text: channel === "hacker-news" ? "" : text.slice(0, 20_000), status: "draft", projectName: loadProject().project.name }]);
    return id;
  }
  const patch = (id: string, data: Partial<Draft>) => update(drafts.map((d) => (d.id === id ? { ...d, ...data } : d)));
  const remove = (id: string) => update(drafts.filter((d) => d.id !== id));
  return { drafts, ready, notice, setNotice, add, patch, remove };
}
export type Queue = ReturnType<typeof useCommunityQueue>;

export function QueueSheet({ q, focus, back }: { q: Queue; focus?: string; back?: () => void }) {
  const [focusId, setFocusId] = useState(focus);
  useEffect(() => {
    if (focusId) document.getElementById(`queue-${focusId}`)?.focus();
  }, [focusId]);
  const count = (s: Draft["status"]) => q.drafts.filter((d) => d.status === s).length;

  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <SheetHead slug={`Queue · ${pad(q.drafts.length)} ${q.drafts.length === 1 ? "entry" : "entries"}`} title="Community queue" back={back}>
        Drafts for communities you post to by hand. Nothing here is posted automatically, and the queue is saved in this browser.
      </SheetHead>

      <div className="mt-8 flex flex-col gap-3">
        <span className={label}>Add an entry</span>
        <div className="flex flex-wrap gap-2">
          {ORDER.map((ch) => (
            <button
              key={ch}
              disabled={!q.ready}
              onClick={() => setFocusId(q.add(ch))}
              className="press flex h-9 items-center gap-2 rounded-md border border-line px-3 text-[14px] font-medium hover:border-ink disabled:opacity-40"
            >
              <PlusIcon size={13} />
              <ChannelLogo c={BYID[ch]} size={14} />
              {ch === "hacker-news" ? "Hacker News" : NAMES[ch]}
            </button>
          ))}
        </div>
        <p className={note}>Hacker News bans AI-written posts, so its entries start blank. Write the title and text yourself.</p>
      </div>

      <dl className="mt-8 grid grid-cols-3 border-y border-line">
        {STATUS.map((s, i) => (
          <div key={s.value} className={`flex flex-col gap-2 py-4 ${i ? "border-l border-line pl-4" : ""}`}>
            <dt className={label}>{s.label}</dt>
            <dd className={`font-mono text-[28px] leading-none font-medium tracking-[-0.04em] tabular-nums ${s.value === "ready" && count("ready") ? "text-accent" : ""}`}>
              {pad(count(s.value))}
            </dd>
          </div>
        ))}
      </dl>
      <p className={`${note} mt-3`}>Ready means reviewed for manual submission. Submitted means you posted it yourself.</p>

      {q.notice && (
        <p role="status" className="mt-6 border-l-2 border-ink pl-4 text-[13px]">
          {q.notice}
        </p>
      )}

      {q.ready && !q.drafts.length ? (
        <div className="mt-6 flex flex-col gap-2 border-b border-line py-10">
          <p className="text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.04em]">The queue is empty.</p>
          <p className="max-w-[44ch] text-[14px] leading-[1.55] text-muted">Add an entry above, or send a Reddit or Product Hunt draft here from the launch kit.</p>
        </div>
      ) : (
        <ol className="mt-6 border-t border-line">
          {q.drafts.map((d, i) => {
            const name = NAMES[d.channel];
            return (
              <li key={d.id} className="flex flex-col gap-3 border-b border-line py-5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={label}>Q {pad(i + 1)}</span>
                    <ChannelLogo c={BYID[d.channel]} size={15} />
                    <span className="truncate text-[14px] font-medium">{name}</span>
                    <span className="hidden truncate text-[13px] text-muted sm:inline">· {d.projectName}</span>
                  </span>
                  <Segmented name={`Q ${pad(i + 1)} ${name} status`} value={d.status} options={STATUS} onChange={(status) => q.patch(d.id, { status })} />
                </div>
                <textarea
                  id={`queue-${d.id}`}
                  value={d.text}
                  onChange={(e) => q.patch(d.id, { text: e.target.value })}
                  maxLength={20_000}
                  aria-label={`Q ${pad(i + 1)} ${name} draft`}
                  placeholder={d.channel === "hacker-news" ? "Write your own title and submission checklist" : "Paste your draft, then review it for this community"}
                  style={{ outline: "none" }}
                  className="min-h-[120px] w-full resize-none rounded-[6px] border border-line bg-canvas px-3.5 py-3 text-[14px] leading-[1.55] [field-sizing:content] placeholder:text-faint focus:border-ink"
                />
                <div className="flex items-center gap-2">
                  <span className={`${label} mr-auto`}>{d.text.length} chars</span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(d.text).then(
                        () => q.setNotice(`Q ${pad(i + 1)} copied.`),
                        () => q.setNotice("Clipboard is blocked. Select the text and copy manually."),
                      )
                    }
                    disabled={!d.text}
                    aria-label={`Copy Q ${pad(i + 1)} ${name} draft`}
                    className={small}
                  >
                    Copy
                  </button>
                  <button onClick={() => q.remove(d.id)} aria-label={`Remove Q ${pad(i + 1)} ${name} draft`} className={`${mono} press h-7 rounded-md px-2 text-muted hover:bg-hover hover:text-ink`}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
