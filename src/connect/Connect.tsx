"use client";

import { ArrowRightIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AGENT_CLIENTS, briefRequest, FREE_CREDITS, MCP_PATH, type AgentClientId, type AgentEvent } from "@/lib/agent-contracts";
import css from "@/landing/landing.module.css";
import { FPS } from "@/video/schema";
import { Command } from "./Command";
import { agentLabel, ApiError, Clock, createWorkspace, getWorkspace, latest, saveBrief, tc, useAgentEvents, useInterval, type Workspace } from "./live";

type Client = (typeof AGENT_CLIENTS)[number];
type Conn = { client: string; version?: string };

const SCENES = ["Agent", "Product", "Connect", "Launch"] as const;
const CAN = ["film", "copy", "memes"] as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const LABEL = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";
const BODY = "max-w-[56ch] text-[17px] leading-[1.55] text-muted md:text-[18px]";
const pad = (n: number) => String(n + 1).padStart(2, "0");

/** The exact install line per CLI. Codex reads the token from an env var instead of a header flag. */
const INSTALL: Record<AgentClientId, (url: string, token: string) => string[]> = {
  "claude-code": (url, token) => [`claude mcp add --transport http shipcast ${url} --header "Authorization: Bearer ${token}"`],
  codex: (url, token) => [`export SHIPCAST_TOKEN=${token}`, `codex mcp add shipcast --url ${url} --bearer-token-env-var SHIPCAST_TOKEN`],
  "gemini-cli": (url, token) => [`gemini mcp add --transport http --scope user shipcast ${url} --header "Authorization: Bearer ${token}"`],
};
const PLUGIN = ["/plugin marketplace add AmritHehe/codex-event", "/plugin install shipcast@shipcast"];
const ASK = "Use the shipcast MCP server to build a launch film for my product.";

export function Connect() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [moved, setMoved] = useState(false); // focus/scroll only after the user acts, never on first paint
  const [marks, setMarks] = useState<number[]>([]); // epoch ms each scene opened, for in-point timecodes
  const start = useRef(0);
  const [client, setClient] = useState<Client | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [token, setToken] = useState<string | null>(null); // memory only: the server shows it once
  const [url, setUrl] = useState("");
  const [conn, setConn] = useState<Conn | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [opening, setOpening] = useState<{ id: string; name: string } | null>(null);
  const known = useRef<Set<string>>(new Set());

  const go = useCallback((n: number) => {
    const now = Date.now();
    setStep(n);
    setMoved(true);
    setMarks((m) => [...(m.length ? m : [start.current]).slice(0, n), now]);
  }, []);

  const adopt = useCallback((w: Workspace) => {
    setWs(w);
    setCredits(w.credits);
    setUrl((u) => u || w.brief?.url || "");
    const c = latest(w.connections);
    if (c) setConn((prev) => prev ?? { client: c.client, version: c.version });
  }, []);

  // A returning browser already has a workspace (cookie); a missing or offline one is handled where it matters (step 2).
  useEffect(() => {
    start.current = Date.now();
    let off = false;
    getWorkspace()
      .then((w) => !off && w && adopt(w))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [adopt]);

  const open = useCallback(
    (id: string, name: string) => {
      setOpening((o) => o ?? { id, name });
      router.push(`/studio?live=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const listening = !!ws && step >= 2 && !opening;
  const stream = useAgentEvents(listening, (e: AgentEvent) => {
    if (e.type === "connected") setConn({ client: e.client, version: e.version });
    else if (e.type === "tool") setTool(e.name);
    else if (e.type === "credits") setCredits(e.remaining);
    else if (e.type === "project.created") open(e.projectId, e.name);
  });

  // Fallback while the stream is down: poll the workspace for a connection and new projects.
  useInterval(
    listening && !stream,
    async () => {
      try {
        const w = await getWorkspace();
        setLost(false);
        if (!w) return;
        adopt(w);
        const fresh = w.projects.find((p) => !known.current.has(p.id));
        if (fresh) open(fresh.id, fresh.name);
      } catch {
        setLost(true);
      }
    },
    3000,
  );

  // The connected beat: hold it for a moment, then move on to the launch.
  const stepNow = useRef(step);
  useEffect(() => {
    stepNow.current = step;
  });
  useEffect(() => {
    if (!conn) return;
    const t = setTimeout(() => stepNow.current === 2 && go(3), reduce ? 500 : 1600);
    return () => clearTimeout(t);
  }, [conn, go, reduce]);

  const toConnect = (w: Workspace) => {
    known.current = new Set(w.projects.map((p) => p.id));
    go(2);
  };

  const scene = (n: number) => (n < step ? "done" : n === step ? "active" : "next");
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 justify-self-start text-[15px] font-semibold tracking-[-0.02em]">
            <span aria-hidden className="relative block size-[18px] rounded-[4px] bg-ink">
              <span className="absolute inset-y-[4px] left-[7px] w-[2px] bg-accent" />
            </span>
            Shipcast
          </Link>
          <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] uppercase">
            <span className="text-muted">
              SCN {pad(step)} <span className="max-sm:hidden">{SCENES[step]}</span>
            </span>
            <Clock className="text-ink" />
          </p>
          <div className="flex items-center gap-1 justify-self-end">
            <span className={`${LABEL} px-2 tabular-nums max-sm:hidden`} title="Server-paid AI for when no agent is connected">
              <span className="text-ink">{credits ?? FREE_CREDITS}</span> free credits
            </span>
            <Link href="/" aria-label="Close and go back to Shipcast" className="press grid size-9 place-items-center rounded-[6px] text-muted hover:bg-hover hover:text-ink">
              <XIcon size={18} />
            </Link>
          </div>
        </div>
        <Track step={opening ? SCENES.length : step} />
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pt-6 pb-28 md:px-8 md:pt-10">
        <h1 className="sr-only">Connect your agent to Shipcast</h1>
        <ol>
          <Scene n={0} state={scene(0)} focus={moved} at={marks} title="Pick your agent." summary={client?.name} onEdit={!conn ? () => go(0) : undefined}>
            <p className={BODY}>
              Your subscription does the AI work. Shipcast never sees your login.
            </p>
            <AgentList
              selected={client?.id}
              onPick={(c) => {
                setClient(c);
                go(1);
              }}
            />
            <p className="mt-8 text-[15px] leading-[1.55] text-muted">
              No agent?{" "}
              <Link href="/#no-agent" className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink">
                Use {credits ?? FREE_CREDITS} free credits
              </Link>{" "}
              and make the film straight from your URL.
            </p>
          </Scene>

          <Scene n={1} state={scene(1)} focus={moved} at={marks} title="Your product." summary={host || undefined} onEdit={!conn ? () => go(1) : undefined}>
            <Brief
              url={url}
              setUrl={setUrl}
              agent={client?.name ?? "your agent"}
              onSave={async (u, notes) => {
                let w = ws;
                if (!w) {
                  const created = await createWorkspace();
                  w = created.workspace;
                  setToken(created.token);
                }
                adopt(w);
                await saveBrief(u, notes);
                toConnect(w);
              }}
            />
          </Scene>

          <Scene
            n={2}
            state={scene(2)}
            focus={moved}
            at={marks}
            title={`Connect ${client?.name ?? "your agent"}.`}
            summary={conn ? `Connected: ${agentLabel(conn)}` : undefined}
          >
            {client && (
              <ConnectStep
                client={client}
                token={token}
                conn={conn}
                stream={stream}
                lost={lost}
                onReissue={async () => {
                  // With a workspace cookie, POST keeps brief, projects and credits and rotates the token.
                  const rotated = await createWorkspace();
                  setToken(rotated.token);
                  adopt(rotated.workspace);
                }}
                onNext={() => go(3)}
              />
            )}
          </Scene>

          <Scene n={3} state={scene(3)} focus={moved} at={marks} title="Run the launch." summary={opening?.name}>
            {client && <LaunchStep client={client} conn={conn} tool={tool} opening={opening} stream={stream} lost={lost} />}
          </Scene>
        </ol>
      </main>
    </div>
  );
}

/** Scene track under the header: one segment per step, the playhead parks at the active one. */
function Track({ step }: { step: number }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative h-7 ${css.fine}`}>
      <ol className="absolute inset-0 grid grid-cols-4">
        {SCENES.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`border-l border-line pt-[7px] pl-2 font-mono text-[10px] leading-none tracking-[0.08em] uppercase transition-colors duration-300 first:border-l-0 md:pl-3 ${
              i < step ? "bg-ink/[0.035] text-muted" : i === step ? "text-ink" : "text-faint"
            }`}
          >
            {pad(i)}
            <span className={i === step ? "" : "max-sm:hidden"}> {s}</span>
          </li>
        ))}
      </ol>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-px left-0">
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ transform: `translateX(${(step / SCENES.length) * 100}%)` }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: EASE }}
        >
          <span className="absolute inset-y-0 left-0 w-px bg-accent" />
          <span className="absolute -top-px -left-[3px] h-[5px] w-[7px] bg-accent" />
        </motion.div>
      </div>
    </div>
  );
}

/** One step of the flow. Done and upcoming steps collapse to a single hairline row, like clips on a track. */
function Scene({
  n,
  state,
  focus,
  at,
  title,
  summary,
  onEdit,
  children,
}: {
  n: number;
  state: "done" | "active" | "next";
  focus: boolean;
  at: number[];
  title: string;
  summary?: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = state === "active";

  useEffect(() => {
    if (!active || !focus) return;
    // Finished scenes collapse to short rows, so the active one always sits near the top.
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    (root.current?.querySelector<HTMLElement>("[data-autofocus]") ?? heading.current)?.focus({ preventScroll: true });
  }, [active, focus, reduce]);

  const inPoint = at[n] !== undefined ? tc(((at[n] - at[0]) / 1000) * FPS) : "--:--:--:--";

  if (!active) {
    return (
      <li className="border-t border-line last:border-b">
        <div className="grid min-h-16 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:gap-x-10">
          <span className={`${LABEL} tabular-nums ${state === "next" ? "text-faint" : ""}`}>SCN {pad(n)}</span>
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <span className={`text-[19px] font-semibold tracking-[-0.03em] md:text-[22px] ${state === "next" ? "text-faint" : "text-ink"}`}>{SCENES[n]}</span>
            {summary && <span className="min-w-0 truncate font-mono text-[12px] text-muted">{summary}</span>}
          </span>
          <span className="flex items-center gap-4">
            <span className={`${LABEL} text-faint tabular-nums max-md:hidden`}>IN {state === "done" ? inPoint : "--:--:--:--"}</span>
            {state === "done" && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Change ${SCENES[n].toLowerCase()}`}
                className="press h-8 rounded-[6px] px-2.5 text-[13px] font-medium text-muted hover:bg-hover hover:text-ink"
              >
                Change
              </button>
            )}
          </span>
        </div>
      </li>
    );
  }

  return (
    <li aria-current="step" className="border-t border-ink last:border-b">
      <section ref={root} aria-labelledby={`scene-${n}`} className="grid gap-5 pt-7 pb-14 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10 md:pt-9 md:pb-20">
        <div className={`${LABEL} flex gap-4 md:flex-col md:gap-1.5`}>
          <span className="text-accent">SCN {pad(n)}</span>
          <span>{SCENES[n]}</span>
          <Clock className="text-ink max-md:ml-auto" from={at[n]} />
        </div>
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, transform: "translateY(14px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE }}
        >
          <h2
            id={`scene-${n}`}
            ref={heading}
            tabIndex={-1}
            className="mb-4 text-[clamp(42px,6vw,92px)] leading-[0.92] font-semibold tracking-[-0.055em] text-balance outline-none md:mb-6"
          >
            {title}
          </h2>
          {children}
        </motion.div>
      </section>
    </li>
  );
}

function AgentList({ selected, onPick }: { selected?: string; onPick: (c: Client) => void }) {
  return (
    <ul className="mt-10 border-t border-ink md:mt-12" aria-label="Agents">
      {AGENT_CLIENTS.map((c, i) => {
        const does: readonly string[] = c.does;
        const on = c.id === selected;
        return (
          <li key={c.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => onPick(c)}
              aria-describedby={`${c.id}-does`}
              className={`group relative grid w-full grid-cols-[32px_minmax(0,1fr)_24px] items-baseline gap-x-3 gap-y-2.5 py-5 text-left transition-colors hover:bg-panel md:grid-cols-[48px_minmax(0,1fr)_220px_200px_24px] md:items-center md:py-7 ${
                on ? "bg-panel" : ""
              }`}
            >
              {on && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-accent" />}
              <span className="pl-1 font-mono text-[11px] tracking-[0.08em] text-faint tabular-nums md:pl-2">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[clamp(26px,3.2vw,44px)] leading-none font-semibold tracking-[-0.045em] transition-transform duration-300 ease-[var(--ease-out)] md:group-hover:translate-x-2">
                {c.name}
              </span>
              <span className={`${LABEL} max-md:col-start-2`}>{c.plan}</span>
              <span id={`${c.id}-does`} className="flex gap-1.5 max-md:col-start-2">
                <span className="sr-only">Makes {does.join(", ")}.</span>
                {CAN.map((k) => (
                  <span
                    key={k}
                    aria-hidden
                    className={`rounded-[4px] border px-1.5 py-[3px] font-mono text-[10.5px] leading-none tracking-[0.08em] uppercase ${
                      does.includes(k) ? "border-line bg-canvas text-ink" : "border-transparent text-faint line-through"
                    }`}
                  >
                    {k}
                  </span>
                ))}
              </span>
              <ArrowRightIcon
                size={18}
                className="self-center text-muted transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-1 group-hover:text-ink max-md:col-start-3 max-md:row-start-1"
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Brief({
  url,
  setUrl,
  agent,
  onSave,
}: {
  url: string;
  setUrl: (u: string) => void;
  agent: string;
  onSave: (url: string, notes?: string) => Promise<void>;
}) {
  const id = useId();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" } | { kind: "error"; message: string; offline: boolean }>({ kind: "idle" });
  const loading = status.kind === "loading";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const raw = url.trim();
    const full = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!raw || !briefRequest.safeParse({ url: full }).success) {
      setStatus({ kind: "error", message: "Enter your product's address, like https://yourproduct.com", offline: false });
      return;
    }
    setUrl(full);
    setStatus({ kind: "loading" });
    try {
      await onSave(full, notes.trim() || undefined);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong. Try again.",
        offline: err instanceof ApiError && err.offline,
      });
    }
  }

  return (
    <>
      <p className={BODY}>{agent} opens this page first, then up to two more that matter. Use the address your customers land on.</p>
      <form onSubmit={submit} noValidate aria-busy={loading} className="mt-10 max-w-[760px] md:mt-12">
        <label htmlFor={`${id}-url`} className={`${LABEL} mb-2 block`}>
          Product URL
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id={`${id}-url`}
            data-autofocus
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourproduct.com"
            value={url}
            disabled={loading}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status.kind === "error") setStatus({ kind: "idle" });
            }}
            aria-invalid={status.kind === "error" && !status.offline}
            aria-describedby={status.kind === "error" ? `${id}-err` : undefined}
            className="h-14 w-full min-w-0 rounded-[6px] border border-line bg-panel px-4 text-[18px] tracking-[-0.01em] transition-colors outline-none placeholder:text-faint hover:border-faint focus:border-ink disabled:opacity-60 aria-invalid:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="press group inline-flex h-14 items-center justify-center gap-2 rounded-[6px] bg-ink px-6 text-[16px] font-medium text-canvas disabled:opacity-60"
          >
            {loading ? "Saving" : status.kind === "error" && status.offline ? "Try again" : "Save brief"}
            <ArrowRightIcon size={16} weight="bold" className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
          </button>
        </div>

        {status.kind === "error" && (
          <div id={`${id}-err`} role="alert" className={`mt-3 flex gap-3 ${status.offline ? "border-y border-line py-3" : ""}`}>
            <span className="font-mono text-[11px] leading-[22px] tracking-[0.08em] text-accent uppercase">Err</span>
            <p className="text-[15px] leading-[22px] text-ink">
              {status.message}
              {status.offline && (
                <span className="mt-1 block text-[14px] text-muted">
                  Your brief is still here. Or skip agents for now and{" "}
                  <Link href="/#no-agent" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                    make the film from your URL
                  </Link>
                  .
                </span>
              )}
            </p>
          </div>
        )}

        <label htmlFor={`${id}-notes`} className={`${LABEL} mt-8 mb-2 flex justify-between`}>
          <span>
            Notes for {agent} <span className="text-faint">optional</span>
          </span>
          <span className="text-faint tabular-nums">{notes.length} / 500</span>
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={500}
          value={notes}
          disabled={loading}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Launching v2 on Tuesday. Lead with the offline mode."
          className="block w-full resize-y rounded-[6px] border border-line bg-panel px-4 py-3 text-[16px] leading-[1.5] transition-colors outline-none placeholder:text-faint hover:border-faint focus:border-ink disabled:opacity-60"
        />
      </form>
    </>
  );
}

function ConnectStep({
  client,
  token,
  conn,
  stream,
  lost,
  onReissue,
  onNext,
}: {
  client: Client;
  token: string | null;
  conn: Conn | null;
  stream: boolean;
  lost: boolean;
  onReissue: () => Promise<void>;
  onNext: () => void;
}) {
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [reissue, setReissue] = useState<{ kind: "idle" | "loading" } | { kind: "error"; message: string }>({ kind: "idle" });
  const mcpUrl = `${origin}${MCP_PATH}`;

  return (
    <>
      <p className={BODY}>
        Paste this into your terminal. It adds Shipcast as an MCP server for {client.name}, signed with your workspace token.
      </p>

      <div className="mt-8 grid gap-3 md:mt-10">
        {token ? (
          <Command title={`Terminal · ${client.name}`} lines={INSTALL[client.id](mcpUrl, token)} secret={token} />
        ) : (
          <div className="rounded-[10px] border border-line bg-panel px-4 py-5 md:px-5">
            <p className="text-[16px] leading-[1.5] font-medium">Your connect command was shown once, before this page reloaded.</p>
            <p className="mt-1 text-[15px] leading-[1.5] text-muted">
              Generate a new one to see it again. Your brief and films stay; the previous command stops working, so re-run the new one in every CLI you
              connected.
            </p>
            <button
              type="button"
              disabled={reissue.kind === "loading"}
              onClick={async () => {
                setReissue({ kind: "loading" });
                try {
                  await onReissue();
                  setReissue({ kind: "idle" });
                } catch (e) {
                  setReissue({ kind: "error", message: e instanceof Error ? e.message : "Couldn't generate a command. Try again." });
                }
              }}
              className="press mt-4 inline-flex h-10 items-center rounded-[6px] bg-ink px-4 text-[14px] font-medium text-canvas disabled:opacity-60"
            >
              {reissue.kind === "loading" ? "Generating" : "Generate a new connect command"}
            </button>
            {reissue.kind === "error" && (
              <p role="alert" className="mt-3 text-[14px] text-ink">
                <span className="mr-2 font-mono text-[11px] tracking-[0.08em] text-accent uppercase">Err</span>
                {reissue.message}
              </p>
            )}
          </div>
        )}
        <ul className="grid gap-1.5 text-[14px] leading-[1.5] text-muted">
          {token && <li>The token is shown once. It lets an agent write to this workspace and nothing else.</li>}
          {client.id === "codex" && <li>Add the export line to your shell profile so Codex finds the token next time.</li>}
        </ul>
      </div>

      <Lane
        done={!!conn}
        waiting={
          <>
            Waiting for {client.name} to call Shipcast
          </>
        }
        doneText={conn ? `Connected: ${agentLabel(conn)}` : ""}
        meta={lost ? "Reconnecting" : stream ? "Live stream" : "Checking every 3 s"}
      />
      {conn && (
        <button type="button" onClick={onNext} className="press group mt-6 inline-flex h-11 items-center gap-2 rounded-[6px] bg-ink px-5 text-[15px] font-medium text-canvas">
          Next: run the launch
          <ArrowRightIcon size={15} weight="bold" className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
        </button>
      )}
      {client.id === "claude-code" && (
        <div className="mt-14 grid gap-3">
          <p className={LABEL}>
            Optional <span className="text-faint">·</span> Shipcast plugin for <span className="text-ink">/shipcast:launch</span>
          </p>
          <Command title="Inside Claude Code" prompt=">" size="md" lines={PLUGIN} />
        </div>
      )}

    </>
  );
}

function LaunchStep({
  client,
  conn,
  tool,
  opening,
  stream,
  lost,
}: {
  client: Client;
  conn: Conn | null;
  tool: string | null;
  opening: { id: string; name: string } | null;
  stream: boolean;
  lost: boolean;
}) {
  const agent = conn ? agentLabel({ client: conn.client }) : client.name;
  const claude = client.id === "claude-code";
  return (
    <>
      <p className={BODY}>
        {claude ? "In Claude Code, run the launch command." : `In ${client.name}, ask for the film.`} Your agent reads the brief, writes the film scene by
        scene, and the Studio opens here the moment it starts.
      </p>
      <div className="mt-8 grid gap-3 md:mt-10">
        {claude ? (
          <>
            <Command title="Inside Claude Code · with the plugin" prompt=">" lines={["/shipcast:launch"]} />
            <p className="text-[14px] leading-[1.6] text-muted">
              No plugin? Run <code className="rounded-[4px] border border-line bg-panel px-1.5 py-0.5 font-mono text-[13px] text-ink">/mcp__shipcast__launch</code> instead.
            </p>
          </>
        ) : (
          <>
            <Command title={`Inside ${client.name}`} prompt=">" lines={[ASK]} />
            <p className="text-[14px] text-muted">If your CLI lists MCP prompts, Shipcast&apos;s launch prompt does the same.</p>
          </>
        )}
      </div>
      <Lane
        done={!!opening}
        waiting={<>Waiting for {agent} to start the film</>}
        doneText={opening ? `Opening the Studio: ${opening.name}` : ""}
        meta={lost ? "Reconnecting" : tool ? <span className="text-ink normal-case">{tool}</span> : stream ? "Live stream" : "Checking every 3 s"}
      />
      <p className="mt-8 text-[14px] text-muted">
        Keep this tab open. You can also go straight to the{" "}
        <Link href="/studio" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
          Studio
        </Link>
        .
      </p>
    </>
  );
}

/** A track that scans while we wait for the agent, then locks with an ink fill. The page's one signature effect. */
function Lane({ done, waiting, doneText, meta }: { done: boolean; waiting: ReactNode; doneText: string; meta: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-10">
      <div aria-hidden className={`relative h-12 overflow-hidden border-y border-line ${css.fine}`}>
        {!done && !reduce && (
          <motion.div
            className="absolute inset-y-0 right-px left-0"
            initial={{ transform: "translateX(0%)" }}
            animate={{ transform: "translateX(100%)" }}
            transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
          >
            <span className="absolute inset-y-0 left-0 w-px bg-accent" />
            <span className="absolute inset-y-0 -left-24 w-24 bg-gradient-to-r from-transparent to-accent/[0.07]" />
          </motion.div>
        )}
        {done && (
          <>
            <motion.span
              className="absolute inset-0 origin-left bg-ink/[0.045]"
              initial={reduce ? false : { transform: "scaleX(0)" }}
              animate={{ transform: "scaleX(1)" }}
              transition={{ duration: 0.9, ease: EASE }}
            />
            <motion.span
              className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ink"
              initial={reduce ? false : { transform: "scaleX(0)" }}
              animate={{ transform: "scaleX(1)" }}
              transition={{ duration: 0.9, ease: EASE }}
            />
            <motion.span
              className="absolute inset-y-0 right-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-ink uppercase"
              initial={reduce ? false : { opacity: 0, transform: "translateX(-6px)" }}
              animate={{ opacity: 1, transform: "translateX(0px)" }}
              transition={{ duration: 0.4, delay: 0.6, ease: EASE }}
            >
              <CheckIcon size={14} weight="bold" className="text-accent" />
              Locked
            </motion.span>
          </>
        )}
      </div>
      <div role="status" aria-live="polite" className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className={`text-[19px] font-semibold tracking-[-0.02em] md:text-[22px] ${done ? "text-ink" : "text-muted"}`}>{done ? doneText : waiting}</p>
        <p className={`${LABEL} flex gap-4`}>
          {!done && <span>{meta}</span>}
          {!done && <Clock className="text-ink" />}
        </p>
      </div>
    </div>
  );
}
