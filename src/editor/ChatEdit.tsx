"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { editResponse } from "@/lib/contracts";
import { useApiTask } from "@/lib/use-api-task";
import { useEditor } from "./store";

export function ChatEdit() {
  const { state, scene, layer, edit } = useEditor();
  const [instruction, setInstruction] = useState("");
  const [summary, setSummary] = useState("");
  const { busy, error, setError, run, cancel } = useApiTask();
  const latest = useRef(state.project);
  useEffect(() => { latest.current = state.project; }, [state.project]);
  useEffect(() => {
    if (!summary) return;
    const timer = setTimeout(() => setSummary(""), 6000);
    return () => clearTimeout(timer);
  }, [summary]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!instruction.trim()) return;
    const base = state.project;
    setSummary("");
    const result = await run("/api/edit", { project: base, instruction: instruction.trim(), selection: { sceneId: scene.id, layerId: layer?.id ?? null } }, editResponse);
    if (!result) return;
    if (latest.current !== base) {
      setError("The project changed while the edit was running. Send the instruction again to use your latest version.");
      return;
    }
    edit(() => result.project);
    setInstruction("");
    setSummary(result.summary);
  }

  return (
    <form onSubmit={submit} aria-label="Edit video with AI" className="border-t border-line bg-panel px-4 py-3">
      <label htmlFor="chat-instruction" className="mb-2 block font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Edit by instruction · {layer ? "Selected layer" : scene.name}</label>
      <div className="flex gap-2">
        <input id="chat-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={500} required disabled={busy}
          placeholder="Make the headline shorter and change the accent to blue"
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-[13px] disabled:opacity-60" />
        <button disabled={busy || !instruction.trim()} className="press rounded-md bg-ink px-4 text-[13px] font-medium text-white disabled:opacity-50">{busy ? "Editing…" : "Apply edit"}</button>
        {busy && <button type="button" onClick={cancel} className="text-[12px] underline">Cancel</button>}
      </div>
      {busy && <p role="status" className="mt-2 text-[12px] text-muted">Editing your layers. You can undo the result.</p>}
      {error && <p role="alert" className="mt-2 text-[13px]">{error}</p>}
      {summary && <p role="status" className="mt-2 border-l-2 border-accent pl-2 text-[13px]">{summary} <span className="text-muted">Use Undo to revert.</span></p>}
    </form>
  );
}
