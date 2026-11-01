"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PUBLISH_CHANNELS, publishReceipt, publishRequest, type PublishInput, type PublishReceipt } from "@/lib/distribution-contracts";
import { CHANNELS } from "./channels";
import { ChannelLogo } from "./icons";
import { Alert, Chip, Fact, SheetHead, Segmented, Working, field, label, mono, note, pad, primary, secondary } from "./ui";

export type PublishId = PublishInput["channel"];
type Target = (typeof PUBLISH_CHANNELS)[number];

const connectionResponse = z.object({ channels: z.array(z.object({ id: z.string(), configured: z.boolean() })) });
const errorResponse = z.object({ error: z.string() });
const TARGET = Object.fromEntries(PUBLISH_CHANNELS.map((c) => [c.id, c])) as Record<PublishId, Target>;
const CATALOG = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
const ROUTE = { direct: "Official API", aggregator: "Ayrshare" } as const;
const MEDIA_REQUIRED: string[] = ["tiktok", "youtube-shorts", "pinterest"];

export const isPublishable = (id: string): id is PublishId => id in TARGET;
/** Counted the way the contract counts: graphemes, so an emoji is one character. */
export const graphemes = (text: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
const localTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type Check = { status: "idle" | "pending" | "done" | "error"; error?: string; ready: string[] };

/** Workspace key, connection check and receipts. The key lives in memory only and is never stored. */
export function usePublishing() {
  const [key, setKeyRaw] = useState("");
  const [check, setCheck] = useState<Check>({ status: "idle", ready: [] });
  const [receipts, setReceipts] = useState<Partial<Record<PublishId, PublishReceipt>>>({});
  const attempts = useRef(new Map<PublishId, { id: string; payload: string }>());

  const setKey = (next: string) => {
    setKeyRaw(next);
    setCheck({ status: "idle", ready: [] });
  };

  async function connect() {
    setCheck({ status: "pending", ready: [] });
    try {
      const response = await fetch("/api/distribution/connections", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorResponse.safeParse(data).data?.error ?? "Could not check connections.");
      const { channels } = connectionResponse.parse(data);
      setCheck({ status: "done", ready: channels.filter((c) => c.configured).map((c) => c.id) });
    } catch (e) {
      setCheck({ status: "error", ready: [], error: e instanceof Error ? e.message : "Could not check connections." });
    }
  }

  /** One request ID per draft attempt: retrying the same reviewed payload reuses it, any edit starts a new one. */
  const requestId = (channel: PublishId, payload: string) => {
    const prev = attempts.current.get(channel);
    if (prev?.payload === payload) return prev.id;
    const id = crypto.randomUUID();
    attempts.current.set(channel, { id, payload });
    return id;
  };

  async function send(input: PublishInput) {
    const response = await fetch("/api/distribution/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(45_000),
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorResponse.safeParse(data).data?.error ?? "Could not confirm publication. Check the account before trying a new request.");
    const receipt = publishReceipt.parse(data);
    setReceipts((r) => ({ ...r, [input.channel]: receipt }));
    return receipt;
  }
  const clear = (channel: PublishId) =>
    setReceipts((r) => {
      const next = { ...r };
      delete next[channel];
      return next;
    });

  const ready = (channel: PublishId) => check.status === "done" && check.ready.includes(channel);
  return { key, setKey, check, connect, ready, receipts, requestId, send, clear };
}
export type Publishing = ReturnType<typeof usePublishing>;

function connectionChip(pub: Publishing, id: PublishId) {
  if (pub.check.status !== "done") return <Chip tone="off">Not checked</Chip>;
  return pub.ready(id) ? <Chip tone="on">Ready</Chip> : <Chip tone="off">Not configured</Chip>;
}

/** Short status for the hub's top bar. */
export function connectionSummary(pub: Publishing) {
  return pub.check.status === "done" ? `${pad(pub.check.ready.length)}/${pad(PUBLISH_CHANNELS.length)}` : null;
}

/** Key entry and the connection check. Lives in the Connections sheet and inline wherever posting is blocked on it. */
function KeyForm({ pub, id = "publish-key" }: { pub: Publishing; id?: string }) {
  const { check } = pub;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pub.key.length >= 24) pub.connect();
  };
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={id} className={label}>
          Workspace publishing key
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={pub.key}
            onChange={(e) => pub.setKey(e.target.value)}
            aria-describedby={`${id}-hint`}
            style={{ outline: "none" }}
            className={`${field} flex-1 font-mono`}
          />
          <button disabled={pub.key.length < 24 || check.status === "pending"} className={`${secondary} shrink-0`}>
            {check.status === "pending" ? "Checking" : "Check connections"}
          </button>
        </div>
        <p id={`${id}-hint`} className={note}>
          The DISTRIBUTION_TOKEN from the server environment, at least 24 characters. Kept in this tab&apos;s memory, never saved.
          {pub.key && pub.key.length < 24 && ` ${pad(pub.key.length)} of 24 so far.`}
        </p>
      </form>

      <div aria-live="polite">
        {check.status === "pending" && <Working>Checking {PUBLISH_CHANNELS.length} channels</Working>}
        {check.status === "error" && <Alert title="Connections could not be checked.">{check.error}</Alert>}
        {check.status === "done" && (
          <p className="text-[14px]">
            <span className="font-mono tabular-nums">
              {pad(check.ready.length)} of {pad(PUBLISH_CHANNELS.length)}
            </span>{" "}
            channels ready to publish.
            {!check.ready.length && <span className="text-muted"> Add channel credentials on the server, then check again.</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export function ConnectionsSheet({ pub, onPublish, back }: { pub: Publishing; onPublish: (id: PublishId) => void; back?: () => void }) {
  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <SheetHead slug={`OUT · ${pad(PUBLISH_CHANNELS.length)} publishable channels`} title="Connections" back={back}>
        Posting runs through accounts configured on the server. Enter the workspace key to see which channels are ready.
      </SheetHead>

      <div className="mt-8">
        <KeyForm pub={pub} />
      </div>

      <ul className="mt-6 border-t border-line">
        {PUBLISH_CHANNELS.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onPublish(t.id)}
              className="-mx-2 grid w-[calc(100%+16px)] grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-2 py-3.5 text-left transition-colors duration-150 hover:bg-hover"
            >
              <ChannelLogo c={CATALOG[t.id]} size={16} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{t.name}</span>
                <span className={`${label} mt-0.5 block`}>
                  {ROUTE[t.mode]} · {t.limit} ch
                </span>
              </span>
              {connectionChip(pub, t.id)}
            </button>
          </li>
        ))}
      </ul>

      <p className={`${note} mt-6`}>
        Credentials live in .env.local on the server, listed in src/server/distribution/credentials.env.example. Restart the server after adding them. Social tokens
        never reach the browser.
      </p>
    </div>
  );
}

type Step = "compose" | "review" | "receipt";
const STEPS: { id: Step; name: string }[] = [
  { id: "compose", name: "Compose" },
  { id: "review", name: "Review" },
  { id: "receipt", name: "Receipt" },
];

/** Three-segment track: where this post is between draft and receipt. */
function Steps({ at }: { at: Step }) {
  const n = STEPS.findIndex((s) => s.id === at);
  return (
    <ol className="mt-8 grid grid-cols-3 gap-1.5" aria-label="Publishing steps">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === n ? "step" : undefined} className="flex flex-col gap-2">
          <span className={`h-[2px] ${i === n ? "bg-accent" : i < n ? "bg-ink" : "bg-line"}`} />
          <span className={`${mono} ${i <= n ? "text-ink" : "text-faint"}`}>
            {pad(i + 1)} {s.name}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Count({ n, limit }: { n: number; limit: number }) {
  const over = n > limit;
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden className="relative block h-px w-16 bg-line">
        <span className={`absolute inset-y-0 left-0 ${over ? "bg-accent" : "bg-ink"}`} style={{ width: `${Math.min(100, (n / limit) * 100)}%` }} />
      </span>
      <span className={`${mono} ${over ? "text-accent" : "text-muted"}`}>
        {n} / {limit}
      </span>
    </span>
  );
}

const statusWord = { published: "Published.", submitted: "Submitted.", scheduled: "Scheduled." } as const;

export function PublishSheet({
  id,
  pub,
  draft,
  onDraft,
  back,
  backLabel,
}: {
  id: PublishId;
  pub: Publishing;
  /** The kit draft for this channel, when there is one. Edits here are edits to that draft. */
  draft?: string;
  onDraft?: (text: string) => void;
  back?: () => void;
  backLabel?: string;
}) {
  const t = TARGET[id];
  const c = CATALOG[id];
  const [own, setOwn] = useState("");
  const text = draft ?? own;
  const setText = onDraft && draft !== undefined ? onDraft : setOwn;
  const [media, setMedia] = useState("");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [board, setBoard] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [step, setStep] = useState<Step>(pub.receipts[id] ? "receipt" : "compose");
  const [request, setRequest] = useState<PublishInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receipt = pub.receipts[id];

  const length = graphemes(text);
  const over = length > t.limit;
  const firstPost = text.split(/\n\s*\n/)[0]?.trim() ?? "";
  const aggregator = t.mode === "aggregator";
  const scheduled = aggregator && !!date;
  const verb = scheduled ? "Schedule" : "Publish";

  function review(e: FormEvent) {
    e.preventDefault();
    setError("");
    let scheduleAt: string | undefined;
    if (scheduled) {
      const parsed = new Date(date);
      if (!Number.isFinite(parsed.getTime())) return setError("Choose a valid schedule time.");
      scheduleAt = parsed.toISOString();
    }
    const body = {
      channel: id,
      text,
      mediaUrl: aggregator ? media || undefined : undefined,
      scheduleAt,
      title: title || undefined,
      boardId: board || undefined,
      visibility,
    };
    const parsed = publishRequest.safeParse({ requestId: pub.requestId(id, JSON.stringify(body)), ...body });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setRequest(parsed.data);
    setStep("review");
  }

  async function submit() {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      await pub.send(request);
      setStep("receipt");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm publication. Check the account before retrying.");
    } finally {
      setBusy(false);
    }
  }

  // Posting needs a checked key and server credentials for this channel. Writing and reviewing never do.
  const gate =
    pub.check.status !== "done" ? (
      <div className="flex flex-col gap-5 border-l-2 border-ink py-1 pl-4">
        <p className="text-[14px]">
          <span className="font-medium">Publishing is not connected.</span>{" "}
          <span className="text-muted">Enter the workspace key to post this. Your review stays as it is.</span>
        </p>
        <KeyForm pub={pub} id="publish-key-inline" />
      </div>
    ) : !pub.ready(id) ? (
      <div className="border-l-2 border-ink py-1 pl-4">
        <p className="text-[14px]">
          <span className="font-medium">{t.name} is not configured on the server.</span>{" "}
          <span className="text-muted">Add its credentials from credentials.env.example, restart the server, then check connections again.</span>
        </p>
      </div>
    ) : null;

  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <SheetHead slug={`OUT · ${ROUTE[t.mode]} · ${t.limit} ch`} title={step === "receipt" && receipt ? statusWord[receipt.status] : `${aggregator ? "Publish or schedule" : "Publish to"} ${t.name}`} back={back}>
        {step === "compose" &&
          (aggregator
            ? `Ayrshare posts to ${t.name} with media from a public HTTPS URL, now or on a schedule.`
            : `Text only, posted right away through the official ${t.name} API.`)}
        {step === "review" && "Check every field. This is exactly what will be sent."}
        {step === "receipt" && receipt?.status === "published" && `${t.name} confirmed the post.`}
        {step === "receipt" && receipt && receipt.status !== "published" && "Ayrshare accepted the request. That is not confirmed delivery, so check its dashboard."}
      </SheetHead>

      <Steps at={step} />

      {step === "compose" && (
        <form onSubmit={review} className="mt-8 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 border-y border-line py-3">
            <span className={label}>Connection</span>
            {connectionChip(pub, id)}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="publish-text" className={label}>
                Post text{draft !== undefined && " · from your kit"}
              </label>
              <Count n={length} limit={t.limit} />
            </div>
            <textarea
              id="publish-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={draft === undefined ? "Write the post, or generate one in the kit first" : undefined}
              aria-describedby={over ? "publish-over" : undefined}
              style={{ outline: "none" }}
              className={`${field} min-h-[160px] resize-none [field-sizing:content]`}
            />
            {over && (
              <div id="publish-over" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-[13px] text-ink">
                  {length - t.limit} over the {t.name} limit of {t.limit}.
                </p>
                {firstPost && firstPost !== text.trim() && graphemes(firstPost) <= t.limit && (
                  <button type="button" onClick={() => setText(firstPost)} className={`${mono} text-ink underline decoration-line underline-offset-4 hover:decoration-ink`}>
                    Keep the first post only
                  </button>
                )}
              </div>
            )}
          </div>

          {aggregator && (
            <>
              <label className="flex flex-col gap-2">
                <span className={label}>Public media URL{MEDIA_REQUIRED.includes(id) ? "" : " · optional"}</span>
                <input type="url" inputMode="url" placeholder="https://cdn.example.com/launch.mp4" value={media} onChange={(e) => setMedia(e.target.value)} style={{ outline: "none" }} className={field} />
                <span className={note}>A public HTTPS image or video. Local render downloads must be uploaded to your own host first.</span>
              </label>
              <label className="flex flex-col gap-2">
                <span className={label}>Schedule · optional, your local time</span>
                <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={{ outline: "none" }} className={field} />
                <span className={note}>{date && Number.isFinite(new Date(date).getTime()) ? `Sent as ${new Date(date).toISOString()} UTC.` : "Leave empty to post now."}</span>
              </label>
            </>
          )}
          {(id === "youtube-shorts" || id === "pinterest") && (
            <label className="flex flex-col gap-2">
              <span className={label}>Title{id === "pinterest" ? " · optional" : ""}</span>
              <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} style={{ outline: "none" }} className={field} />
            </label>
          )}
          {id === "pinterest" && (
            <label className="flex flex-col gap-2">
              <span className={label}>Pinterest board ID</span>
              <input value={board} inputMode="numeric" onChange={(e) => setBoard(e.target.value)} style={{ outline: "none" }} className={`${field} font-mono`} />
            </label>
          )}
          {id === "youtube-shorts" && (
            <div className="flex flex-col gap-2">
              <span className={label}>YouTube visibility</span>
              <Segmented
                name="YouTube visibility"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: "private", label: "Private" },
                  { value: "unlisted", label: "Unlisted" },
                  { value: "public", label: "Public" },
                ]}
              />
            </div>
          )}

          {error && <Alert title="Fix this before review.">{error}</Alert>}
          <button disabled={!text.trim() || over} className={`${primary} self-start`}>
            Review post
          </button>
        </form>
      )}

      {step === "review" && request && (
        <div className="mt-8 flex flex-col">
          <dl className="border-b border-line">
            <Fact name="Destination">
              <span className="flex items-center gap-2 font-medium">
                <ChannelLogo c={c} size={15} />
                {t.name}
              </span>
              <span className="mt-1 block text-muted">{aggregator ? "Through Ayrshare, on the connected account." : `Official API, on the configured account.`}</span>
            </Fact>
            <Fact name="Text">
              <p className="rounded-[6px] border border-line bg-canvas px-3.5 py-3 break-words whitespace-pre-wrap">{request.text}</p>
            </Fact>
            <Fact name="Length">
              <Count n={graphemes(request.text)} limit={t.limit} />
            </Fact>
            <Fact name="Visibility">
              {id === "youtube-shorts" ? request.visibility[0].toUpperCase() + request.visibility.slice(1) : id === "mastodon" ? "Public" : "Account default"}
            </Fact>
            <Fact name="When">
              {request.scheduleAt ? (
                <>
                  {localTime(request.scheduleAt)}
                  <span className={`${note} block`}>{request.scheduleAt} UTC</span>
                </>
              ) : (
                "Now, on confirm"
              )}
            </Fact>
            {request.mediaUrl && (
              <Fact name="Media">
                <span className="font-mono text-[12px] break-all">{request.mediaUrl}</span>
              </Fact>
            )}
            {request.title && <Fact name="Title">{request.title}</Fact>}
            {request.boardId && (
              <Fact name="Board">
                <span className="font-mono">{request.boardId}</span>
              </Fact>
            )}
            <Fact name="Request">
              <span className="font-mono text-[12px] break-all">{request.requestId}</span>
              <span className={`${note} mt-1 block`}>Retries reuse this ID, so one review can never post twice.</span>
            </Fact>
          </dl>

          {gate && <div className="mt-6">{gate}</div>}
          <div aria-live="polite" className="mt-6 flex flex-col gap-4 empty:hidden">
            {busy && <Working>{scheduled ? "Scheduling" : "Publishing"} on {t.name}</Working>}
            {error && !busy && (
              <Alert title="The post was not confirmed.">
                {error}
                <span className="mt-2 block text-ink">Try again resends the same request ID. If the destination shows no post, edit the draft to start a new request.</span>
              </Alert>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={submit} disabled={busy || !pub.ready(id)} className={primary}>
              {busy ? (scheduled ? "Scheduling" : "Publishing") : error ? "Try again" : request.scheduleAt ? `Schedule on ${t.name}` : `${verb} to ${t.name} now`}
            </button>
            <button onClick={() => (setStep("compose"), setError(""))} disabled={busy} className={secondary}>
              Edit
            </button>
          </div>
        </div>
      )}

      {step === "receipt" && receipt && (
        <div className="mt-8 flex flex-col">
          <dl className="border-b border-line">
            <Fact name="Status">
              <Chip tone="on">{receipt.status}</Chip>
            </Fact>
            <Fact name="Destination">
              <span className="flex items-center gap-2 font-medium">
                <ChannelLogo c={c} size={15} />
                {t.name}
              </span>
            </Fact>
            <Fact name="Link">
              {receipt.url ? (
                <a href={receipt.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                  View post <ArrowUpRightIcon size={13} />
                </a>
              ) : (
                <span className="text-muted">{t.name} did not return a link. Find the post on the account.</span>
              )}
            </Fact>
            {receipt.scheduleAt && (
              <Fact name="Goes out">
                {localTime(receipt.scheduleAt)}
                <span className={`${note} block`}>{receipt.scheduleAt} UTC</span>
              </Fact>
            )}
            <Fact name="Reference">
              <span className="font-mono text-[12px] break-all">{receipt.providerId}</span>
            </Fact>
            <Fact name="Request">
              <span className="font-mono text-[12px] break-all">{receipt.requestId}</span>
            </Fact>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {back && (
              <button onClick={back} className={primary}>
                {backLabel ?? "Back"}
              </button>
            )}
            <button
              onClick={() => {
                pub.clear(id);
                setRequest(null);
                setStep("compose");
              }}
              className={secondary}
            >
              Write another post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
