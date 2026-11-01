"use client";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PUBLISH_CHANNELS, publishReceipt, publishRequest, type PublishReceipt } from "@/lib/distribution-contracts";

const connectionResponse = z.object({ channels: z.array(z.object({ id: z.string(), configured: z.boolean() })) });
const errorResponse = z.object({ error: z.string() });
const field = "mt-1 block w-full rounded-md border border-line bg-panel px-3 py-2 text-[14px] disabled:opacity-50";

export function Publisher() {
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState<string[]>([]);
  const [channel, setChannel] = useState("x");
  const [text, setText] = useState("");
  const [media, setMedia] = useState("");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [board, setBoard] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [receipt, setReceipt] = useState<PublishReceipt | null>(null);
  const requestId = useRef<string | null>(null);
  const config = PUBLISH_CHANNELS.find((c) => c.id === channel)!;
  const change = (fn: () => void) => { fn(); requestId.current = null; setReceipt(null); setError(""); };

  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/distribution/connections", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorResponse.safeParse(data).data?.error ?? "Could not check connections.");
      const { channels } = connectionResponse.parse(data);
      setConnected(channels.filter((c) => c.configured).map((c) => c.id)); setChecked(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not check connections."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    requestId.current ??= crypto.randomUUID();
    let scheduleAt: string | undefined;
    if (date && config.mode === "aggregator") {
      const parsed = new Date(date);
      if (!Number.isFinite(parsed.getTime())) { setError("Choose a valid schedule time."); return; }
      scheduleAt = parsed.toISOString();
    }
    const parsed = publishRequest.safeParse({ requestId: requestId.current, channel, text, mediaUrl: config.mode === "aggregator" ? media || undefined : undefined, scheduleAt, title: title || undefined, boardId: board || undefined, visibility });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/distribution/publish", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(45_000) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorResponse.safeParse(data).data?.error ?? "Could not confirm publication. Check the account before trying a new request.");
      setReceipt(publishReceipt.parse(data));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not confirm publication. Check the account before retrying."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4 py-6">
      <h3 className="text-[20px] font-semibold tracking-tight">Publish a reviewed draft</h3>
      <p className="text-[14px] text-muted">Paste and review your copy, then choose the destination. Direct channels publish text immediately. Aggregator channels support media and scheduling.</p>
      <fieldset disabled={busy} className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-[13px]">Workspace publishing key<input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setChecked(false); setConnected([]); }} className={field} /></label>
          <button type="button" onClick={connect} disabled={key.length < 24} className="press h-10 rounded-md border border-line px-3 text-[13px] disabled:opacity-40">Check connections</button>
        </div>
        <label className="block text-[13px]">Destination<select value={channel} onChange={(e) => change(() => { setChannel(e.target.value); setDate(""); setMedia(""); })} className={field}>{PUBLISH_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.mode}{checked ? connected.includes(c.id) ? " · connected" : " · not configured" : ""}</option>)}</select></label>
        <label className="block text-[13px]">Post text<textarea rows={5} value={text} onChange={(e) => change(() => setText(e.target.value))} required className={field} /><span className="mt-1 block text-[12px] text-muted">Channel limit: {config.limit} characters. The destination also validates its own rules.</span></label>
        {config.mode === "aggregator" && (
          <>
            <label className="block text-[13px]">Public media URL<input type="url" placeholder="https://cdn.your-product.com/launch.mp4" value={media} onChange={(e) => change(() => setMedia(e.target.value))} className={field} /><span className="mt-1 block text-[12px] text-muted">The destination needs a public HTTPS image or video. Local render URLs cannot be uploaded by the aggregator.</span></label>
            <label className="block text-[13px]">Schedule in your local time (optional)<input type="datetime-local" value={date} onChange={(e) => change(() => setDate(e.target.value))} className={field} />{date && Number.isFinite(new Date(date).getTime()) && <span className="mt-1 block text-[12px] text-muted">UTC: {new Date(date).toISOString()}</span>}</label>
          </>
        )}
        {["youtube-shorts", "pinterest"].includes(channel) && <label className="block text-[13px]">Title<input value={title} maxLength={100} onChange={(e) => change(() => setTitle(e.target.value))} className={field} /></label>}
        {channel === "pinterest" && <label className="block text-[13px]">Pinterest board ID<input value={board} inputMode="numeric" onChange={(e) => change(() => setBoard(e.target.value))} className={field} /></label>}
        {channel === "youtube-shorts" && <label className="block text-[13px]">YouTube visibility<select value={visibility} onChange={(e) => change(() => setVisibility(e.target.value as typeof visibility))} className={field}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>}
        <button disabled={!checked || !connected.includes(channel) || !text.trim() || !!receipt} className="press rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-canvas disabled:opacity-40">{busy ? "Submitting…" : date && config.mode === "aggregator" ? `Schedule on ${config.name}` : `Publish to ${config.name}`}</button>
      </fieldset>
      {checked && !connected.includes(channel) && <p className="text-[13px] text-muted">This channel needs server credentials before it can publish.</p>}
      {error && <p role="alert" className="border-l-2 border-accent pl-3 text-[13px]">{error}</p>}
      {receipt && <p role="status" className="border-l-2 border-accent pl-3 text-[14px]">{receipt.status === "published" ? "Published" : receipt.status === "scheduled" ? "Scheduled with the aggregator" : "Submitted to the aggregator"}. Reference: {receipt.providerId}{receipt.url && <> · <a href={receipt.url} target="_blank" rel="noreferrer" className="underline">View post</a></>}</p>}
    </form>
  );
}
