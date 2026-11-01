"use client";

// Client side of the bring-your-own-agent contract (src/lib/agent-contracts.ts): workspace calls, the live
// event stream and a polling fallback. Shared by /connect and the Studio's live build.
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AGENT_CLIENTS, agentEvent, createWorkspaceResponse, projectResponse, workspace, type AgentEvent } from "@/lib/agent-contracts";
import { apiError } from "@/lib/contracts";
import { FPS } from "@/video/schema";

export type Workspace = z.infer<typeof workspace>;
export type Connection = Workspace["connections"][number];

/** `offline`: the route itself is missing or unreachable (backend not deployed yet), not an application error. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly offline = false) {
    super(message);
  }
}

async function api<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach Shipcast. Check your connection and try again.", 0, true);
  }
  // Our API always answers JSON. Anything else (an HTML 404) means the endpoint isn't there.
  const json = !!res.headers.get("content-type")?.includes("application/json");
  const data: unknown = json ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (!json) throw new ApiError(`The Shipcast agent server isn't running here yet (${res.status}). Try again in a moment.`, res.status, true);
    throw new ApiError(apiError.safeParse(data).data?.error ?? `Request failed (${res.status}).`, res.status);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError("Shipcast answered in a format this page doesn't know. Reload to get the latest version.", res.status);
  return parsed.data;
}

/** Current workspace (cookie auth), or null when this browser has none yet. */
export async function getWorkspace(): Promise<Workspace | null> {
  try {
    return await api("/api/workspace", workspace);
  } catch (e) {
    if (e instanceof ApiError && !e.offline && (e.status === 401 || e.status === 404)) return null;
    throw e;
  }
}

export const createWorkspace = () => api("/api/workspace", createWorkspaceResponse, {});

// ponytail: response body unused (contract doesn't define it); we only need the 2xx.
export const saveBrief = (url: string, notes?: string) => api("/api/workspace/brief", z.unknown(), { url, notes });

export const getProject = (id: string) => api(`/api/projects/${encodeURIComponent(id)}`, projectResponse);

/** Most recently seen agent connection. */
export const latest = (cs: Connection[]) => cs.reduce<Connection | null>((a, c) => (!a || c.lastSeen > a.lastSeen ? c : a), null);

/** "Claude Code v2.1.4": MCP clientInfo names map to our display names when we know them. */
export function agentLabel(c: { client: string; version?: string }) {
  // Real clientInfo names seen in the wild: "codex-mcp-client", "claude-code", "gemini-cli-mcp-client".
  const id = /codex/i.test(c.client) ? "codex" : /claude/i.test(c.client) ? "claude-code" : /gemini/i.test(c.client) ? "gemini-cli" : c.client;
  const name = AGENT_CLIENTS.find((a) => a.id === id)?.name ?? c.client;
  return c.version ? `${name} v${c.version.replace(/^v/, "")}` : name;
}

/**
 * Live workspace events over SSE, each `data:` validated with `agentEvent`. Returns whether the stream is open
 * so callers can fall back to polling. EventSource reconnects on its own after drops and skips `: ping` comments.
 */
export function useAgentEvents(enabled: boolean, onEvent: (e: AgentEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/workspace/events");
    es.onopen = () => setOpen(true);
    es.onerror = () => setOpen(false);
    es.onmessage = (m) => {
      try {
        const ev = agentEvent.safeParse(JSON.parse(m.data));
        if (ev.success) handler.current(ev.data);
      } catch {
        // not JSON: ignore the line, keep listening
      }
    };
    return () => {
      es.close();
      setOpen(false);
    };
  }, [enabled]);
  return enabled && open;
}

export function useInterval(enabled: boolean, fn: () => void, ms: number) {
  const f = useRef(fn);
  useEffect(() => {
    f.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => f.current(), ms);
    return () => clearInterval(t);
  }, [enabled, ms]);
}

/** Frames to broadcast timecode, HH:MM:SS:FF. */
export function tc(frames: number) {
  const f = Math.max(0, Math.round(frames));
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${p(f / (FPS * 3600))}:${p((f / (FPS * 60)) % 60)}:${p((f / FPS) % 60)}:${p(f % FPS)}`;
}

/** Running timecode since mount (or since `from`, epoch ms). Written to the DOM, no re-renders. */
export function Clock({ from, className }: { from?: number; className?: string }) {
  const out = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = from ?? Date.now();
    const tick = () => {
      if (out.current) out.current.textContent = tc(((Date.now() - start) / 1000) * FPS);
    };
    tick();
    const t = setInterval(tick, 1000 / FPS);
    return () => clearInterval(t);
  }, [from]);
  return (
    <span ref={out} className={`tabular-nums ${className ?? ""}`}>
      {tc(0)}
    </span>
  );
}
