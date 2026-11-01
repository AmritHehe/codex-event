"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { agentLabel, Clock, getProject, getWorkspace, latest, useAgentEvents, useInterval } from "@/connect/live";
import { projectSchema, type Project } from "@/video/schema";
import { pad2 } from "./Panels";
import { focusFrame, useEditor } from "./store";
import { Button, cx, IconButton } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Couldn't load the agent's film.");

/**
 * F10.2: `/studio?live=<projectId>` follows a film the user's agent is writing over MCP. Every scene/theme/finish
 * event refetches the project and lands it in the editor as one undoable edit. If the user changed anything since
 * the last agent update, the new version waits behind "Apply" instead of replacing their work.
 */
export function LiveStrip() {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const { state, edit, player } = useEditor();
  const [projectId, setProjectId] = useState(() => params.get("live")); // captured once: the URL is cleaned when the film is ready
  const [agent, setAgent] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "building" | "ready">("loading");
  const [scenes, setScenes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Project | null>(null);
  const [closed, setClosed] = useState(false);

  const applied = useRef<Project | null>(null); // last agent version we put in the editor
  const current = useRef(state.project);
  const focusScene = useRef<string | null>(null);
  const seekTo = useRef<string | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  useEffect(() => {
    current.current = state.project;
  });

  const apply = useCallback(
    (p: Project) => {
      const sceneId = (focusScene.current && p.scenes.find((s) => s.id === focusScene.current)?.id) ?? p.scenes.at(-1)!.id;
      applied.current = p;
      seekTo.current = sceneId;
      setPending(null);
      edit(() => p, undefined, { sceneId, layerId: null });
    },
    [edit],
  );

  // Serialised refetch: events can burst (one per scene); never run two at once, but never drop the last one.
  const refresh = useCallback(async () => {
    if (!projectId) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    do {
      again.current = false;
      try {
        const r = await getProject(projectId);
        setError(null);
        setStatus(r.status);
        setScenes(r.project.scenes.length);
        const parsed = projectSchema.safeParse(r.project); // needs at least one scene to be playable
        if (parsed.success) {
          const edited = applied.current !== null && current.current !== applied.current;
          if (edited) setPending(parsed.data);
          else apply(parsed.data);
        }
      } catch (e) {
        setError(errText(e));
      }
    } while (again.current);
    busy.current = false;
  }, [projectId, apply]);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Who is building: the connection the workspace already knows about (the `connected` event fired on /connect).
  useEffect(() => {
    if (!projectId) return;
    let off = false;
    getWorkspace()
      .then((w) => {
        const c = w && latest(w.connections);
        if (!off && c) setAgent((a) => a ?? agentLabel(c));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [projectId]);

  const building = !!projectId && status !== "ready";
  const stream = useAgentEvents(!!projectId, (e) => {
    if (e.type === "connected") setAgent(agentLabel(e));
    else if (e.type === "tool") setTool(e.name);
    else if (e.type === "project.created" && e.projectId !== projectId) {
      // The agent started another film: follow it.
      window.history.replaceState(null, "", `/studio?live=${encodeURIComponent(e.projectId)}`);
      setProjectId(e.projectId);
      setStatus("loading");
      setScenes(0);
      setClosed(false);
    } else if ("projectId" in e && e.projectId === projectId && (e.type === "scene.upserted" || e.type === "theme.set" || e.type === "project.finished")) {
      if (e.type === "scene.upserted") focusScene.current = e.sceneId;
      void refresh();
    }
  });
  useInterval(building && !stream, refresh, 3000);

  // Save the user's edits back so the agent's get_project sees them. Only edits made on top of this project's agent
  // version: the agent's own version (=== applied) is never echoed, and nothing is sent before it has loaded.
  useEffect(() => {
    const p = state.project;
    if (!projectId || applied.current?.id !== projectId || p === applied.current) return;
    const t = setTimeout(() => {
      fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: p }),
      }).catch(() => {}); // offline: the local autosave still has it, the next edit retries
    }, 1500);
    return () => clearTimeout(t);
  }, [state.project, projectId]);

  // Park the playhead on the scene that just landed, once the player has the new duration.
  useEffect(() => {
    if (!seekTo.current || state.project !== applied.current) return;
    player.current?.seekTo(focusFrame(state.project, seekTo.current));
    seekTo.current = null;
  }, [state.project, player]);

  // A finished film is just a project now: drop ?live so a reload doesn't pull the agent's version over local edits.
  useEffect(() => {
    if (status === "ready" && window.location.search.includes("live=")) window.history.replaceState(null, "", "/studio");
  }, [status]);

  if (!projectId || closed) return null;
  const ready = status === "ready";

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase lg:col-span-3 lg:row-start-2">
      {ready ? (
        <span className="flex items-center gap-1.5 text-ink">
          <CheckIcon size={13} weight="bold" className="text-accent" />
          Ready
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-accent" title="Your agent is writing this film">
          <motion.span
            aria-hidden
            className="size-[7px] rounded-[1px] bg-accent"
            animate={reduce ? undefined : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Rec
        </span>
      )}
      <span className="min-w-0 truncate font-sans text-[12.5px] font-medium tracking-normal text-ink normal-case">{agent ?? "Your agent"}</span>
      <span aria-hidden className="h-4 w-px shrink-0 bg-line max-sm:hidden" />
      <span className="relative h-4 min-w-0 overflow-hidden normal-case max-md:hidden" title="Last tool call">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={tool ?? "none"}
            className={cx("block truncate", tool ? "text-ink" : "text-faint")}
            initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-8px)" }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {tool ?? "no tool calls yet"}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={cx("shrink-0 tabular-nums", pending && "max-sm:hidden")}>
        {error ? (
          <span role="alert" className="flex items-center gap-2 normal-case">
            <span className="text-accent uppercase">Err</span>
            <span className="max-w-[46ch] truncate font-sans text-[12px] tracking-normal text-ink">
              {error} {building && "Retrying."}
            </span>
          </span>
        ) : status === "loading" ? (
          "Loading film"
        ) : scenes === 0 ? (
          "Waiting for the first scene"
        ) : (
          <>
            <span className="text-ink">{pad2(scenes)}</span> {scenes === 1 ? "scene" : "scenes"} written
          </>
        )}
      </span>
      <span className="sr-only" role="status">
        {ready ? "The agent finished the film." : scenes ? `${scenes} scenes written` : ""}
      </span>
      {!ready && <Clock className="text-ink max-sm:hidden" />}

      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-sans tracking-normal normal-case">
        {pending && (
          <>
            <span className="font-sans text-[12.5px] font-medium tracking-normal text-ink max-md:hidden">Agent updated the film</span>
            <Button variant="primary" onClick={() => apply(pending)} title="Replace with the agent's version. Undo brings yours back.">
              Apply
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep mine
            </Button>
          </>
        )}
        {ready && !pending && (
          <IconButton label="Close live strip" onClick={() => setClosed(true)}>
            <XIcon size={14} />
          </IconButton>
        )}
      </span>
    </div>
  );
}
