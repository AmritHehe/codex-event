"use client";

import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { label, mono, pad, primary, secondary, small } from "@/distribution/ui";
import type { PublishTarget } from "./PublishDemo";

// Remotion renders client-only.
const PublishDemo = dynamic(() => import("./PublishDemo").then((m) => m.PublishDemo), { ssr: false });

const Library = z.object({
  credits: z.number().catch(0),
  connections: z.array(z.object({ client: z.string(), version: z.string().nullish(), lastSeen: z.string() })).catch([]),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["building", "ready"]).catch("building"),
        updatedAt: z.string(),
        scenes: z.number().catch(0),
        url: z.string().nullish(),
        drafts: z.array(z.object({ channelId: z.string(), text: z.string(), hashtags: z.array(z.string()).nullish() })).catch([]),
        assets: z
          .array(z.object({ id: z.string(), kind: z.enum(["meme", "screenshot", "logo"]).catch("meme"), caption: z.string().nullish(), url: z.string() }))
          .catch([]),
      }),
    )
    .catch([]),
});
type Library = z.infer<typeof Library>;
type Project = Library["projects"][number];

type State = { kind: "loading" } | { kind: "empty" } | { kind: "error" } | { kind: "ok"; data: Library };

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [publish, setPublish] = useState<PublishTarget | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/workspace/library", { cache: "no-store" })
      .then(async (res) => {
        // Not signed in or endpoint not shipped yet: nothing to show, so point at the connect flow.
        if (res.status === 401 || res.status === 404) return { kind: "empty" } as const;
        if (!res.ok) return { kind: "error" } as const;
        const parsed = Library.safeParse(await res.json());
        if (!parsed.success) return { kind: "error" } as const;
        return { kind: "ok", data: parsed.data } as const;
      })
      .catch(() => ({ kind: "error" }) as const)
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [attempt]);

  const data = state.kind === "ok" ? state.data : null;
  const empty = state.kind === "empty" || (data !== null && data.projects.length === 0);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 md:px-10">
      <div className={`${label} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-2.5`}>
        <span>Dashboard</span>
        <span className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            Credits <span className="text-ink">{data ? data.credits : "--"}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3">
            Agents
            {data && data.connections.length > 0 ? (
              data.connections.map((c) => (
                <span key={c.client} className="text-ink" title={`Last seen ${when(c.lastSeen)}`}>
                  {c.client}
                  {c.version && <span className="text-muted"> v{c.version}</span>}
                </span>
              ))
            ) : (
              <span className="text-ink">{data ? "None" : "--"}</span>
            )}
          </span>
        </span>
      </div>

      <header className="pt-12 pb-10 md:pt-20 md:pb-14">
        <h1 className="text-[clamp(44px,8vw,128px)] leading-[0.9] font-semibold tracking-[-0.06em]">Launch kit</h1>
        <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.55] text-muted">
          Every film, image and post draft your agent or the free credit generator made, in one place.
        </p>
      </header>

      {state.kind === "loading" && (
        <p role="status" className={`${label} border-t border-line py-8`}>
          Loading library
        </p>
      )}

      {state.kind === "error" && (
        <div role="alert" className="border-t border-line py-10">
          <p className="text-[17px] font-medium">Could not load your library.</p>
          <button onClick={() => (setState({ kind: "loading" }), setAttempt((n) => n + 1))} className={`${secondary} mt-5`}>
            Try again
          </button>
        </div>
      )}

      {empty && (
        <section className="border-t border-ink pt-10">
          <p className={label}>SCN 00 · 00:00:00:00</p>
          <h2 className="mt-6 text-[clamp(32px,5vw,64px)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance">
            No launch kit yet.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/connect" className={`${primary} inline-flex items-center gap-2`}>
              Connect your agent <ArrowRightIcon size={14} />
            </Link>
            <Link href="/#no-agent" className={`${secondary} inline-flex items-center`}>
              or generate with free credits
            </Link>
            <button onClick={() => setPublish({ id: null, name: "Sample launch film", drafts: [] })} className={`${secondary} inline-flex items-center`}>
              Try the publish demo
            </button>
          </div>
        </section>
      )}

      {data && data.projects.length > 0 && (
        <section aria-labelledby="films" className="border-t border-ink">
          <h2 id="films" className={`${label} py-3`}>
            Films · {pad(data.projects.length)}
          </h2>
          <ol>
            {data.projects.map((p, i) => (
              <Film key={p.id} p={p} n={i + 1} onPublish={() => setPublish({ id: p.id, name: p.name, drafts: p.drafts })} />
            ))}
          </ol>
        </section>
      )}

      {publish && <PublishDemo target={publish} onClose={() => setPublish(null)} />}
    </div>
  );
}

function Film({ p, n, onPublish }: { p: Project; n: number; onPublish: () => void }) {
  return (
    <li className="border-t border-line py-8">
      <div className="grid gap-4 md:grid-cols-[48px_minmax(0,1fr)_auto] md:items-baseline">
        <span className={label}>{pad(n, 3)}</span>
        <div className="min-w-0">
          <h3 className="text-[24px] leading-tight font-semibold tracking-[-0.03em]">{p.name}</h3>
          <p className={`${label} mt-2 flex flex-wrap gap-x-4`}>
            <span className={p.status === "ready" ? "text-ink" : "text-accent"}>{p.status}</span>
            <span>SCN {pad(p.scenes)}</span>
            <span>Updated {when(p.updatedAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-self-start">
          <button onClick={onPublish} className={`${primary} inline-flex items-center`}>
            Publish
          </button>
          <Link href={`/studio?live=${encodeURIComponent(p.id)}`} className={`${secondary} inline-flex items-center gap-2`}>
            Open in Studio <ArrowUpRightIcon size={14} />
          </Link>
        </div>
      </div>

      {p.assets.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-3 md:ml-[64px] md:grid-cols-3 xl:grid-cols-4">
          {p.assets.map((a) => (
            <li key={a.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote user assets, unknown hosts */}
              <img src={a.url} alt={a.caption ?? `${a.kind} for ${p.name}`} loading="lazy" className="aspect-square w-full rounded-[10px] border border-line bg-panel object-cover" />
              <p className={`${label} mt-2 truncate`}>
                {a.kind}
                {a.caption && <span className="normal-case tracking-normal"> · {a.caption}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {p.drafts.length > 0 && (
        <ul className="mt-8 grid gap-3 md:ml-[64px] lg:grid-cols-2">
          {p.drafts.map((d, i) => (
            <Draft key={`${d.channelId}-${i}`} channel={d.channelId} text={[d.text, d.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")].filter(Boolean).join("\n\n")} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Draft({ channel, text }: { channel: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <li className="rounded-[10px] border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`${mono} text-ink`}>{channel}</span>
        <button onClick={copy} className={`${small} inline-flex items-center gap-1.5`} aria-label={`Copy ${channel} draft`}>
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[14px] leading-[1.55] whitespace-pre-wrap">{text}</p>
    </li>
  );
}
