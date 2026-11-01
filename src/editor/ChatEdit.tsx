"use client";

import { ArrowElbowDownLeftIcon, CheckIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { editResponse, postJson } from "@/lib/contracts";
import { pad2 } from "./Panels";
import { useEditor } from "./store";
import { cx, IconButton, isTyping, Kbd, Label } from "./ui";

type Notice = { kind: "ok" | "error"; text: string; at: number };

const errorText = (e: unknown) =>
  e instanceof TypeError ? "Could not reach /api/edit." : e instanceof z.ZodError ? "The edit service returned an invalid project." : e instanceof Error ? e.message : "Edit failed.";

/** F3.2: natural-language edit. The returned project lands as one undo step. */
export function ChatEdit() {
  const { state, scene, layer, edit, undo } = useEditor();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const si = state.project.scenes.indexOf(scene);
  const li = layer ? scene.layers.indexOf(layer) : -1;

  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const instruction = text.trim();
    if (!instruction || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const res = await postJson("/api/edit", { project: state.project, instruction, selection: { sceneId: scene.id, layerId: layer?.id ?? null } }, editResponse);
      edit(() => res.project);
      setNotice({ kind: "ok", text: res.summary, at: Date.now() });
      setText("");
    } catch (err) {
      setNotice({ kind: "error", text: errorText(err), at: Date.now() });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative shrink-0 border-t border-line bg-panel transition-colors duration-150 focus-within:bg-white">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.at}
            role={notice.kind === "error" ? "alert" : "status"}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="absolute bottom-full left-3 z-20 mb-2 flex max-w-[min(520px,calc(100%-24px))] items-center gap-2 rounded-md border border-line bg-panel py-1.5 pr-1 pl-2.5 text-[12px] shadow-pop"
          >
            {notice.kind === "ok" ? <CheckIcon size={13} weight="bold" className="shrink-0 text-ink" /> : <WarningIcon size={13} weight="fill" className="shrink-0 text-accent" />}
            <span className="min-w-0 truncate">{notice.kind === "error" ? `Edit failed: ${notice.text}` : notice.text}</span>
            {notice.kind === "ok" && (
              <button
                type="button"
                onClick={() => {
                  undo();
                  setNotice(null);
                }}
                className="press shrink-0 rounded-[4px] px-1.5 py-0.5 font-medium text-muted hover:bg-hover hover:text-ink"
              >
                Undo
              </button>
            )}
            <IconButton type="button" label="Dismiss" className="size-6" onClick={() => setNotice(null)}>
              <XIcon size={11} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {pending && (
        <div aria-hidden className="absolute inset-x-0 -top-px h-px overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-accent"
            initial={{ transform: "translateX(-100%)" }}
            animate={{ transform: "translateX(300%)" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: [0.77, 0, 0.175, 1] }}
          />
        </div>
      )}

      <div className="flex h-11 items-center gap-2 px-3">
        <Label className="shrink-0 text-ink max-sm:hidden">Prompt</Label>
        <input
          ref={input}
          aria-label="Describe an edit"
          value={text}
          maxLength={500}
          readOnly={pending}
          onChange={(e) => setText(e.target.value)}
          placeholder={pending ? "Applying edit" : "Describe a change, like “make the hook shorter”"}
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint focus-visible:outline-none!"
        />
        <span
          title="Edits apply to this selection"
          className="shrink-0 rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted tabular-nums max-sm:hidden"
        >
          SCN {pad2(si + 1)}
          {li >= 0 && ` / L${li + 1}`}
        </span>
        {!text && !pending && (
          <span className="max-lg:hidden">
            <Kbd>/</Kbd>
          </span>
        )}
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Apply edit"
          className={cx("press inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12px] font-medium text-canvas hover:bg-ink/85 disabled:opacity-30")}
        >
          {pending ? "Applying" : "Apply"}
          <ArrowElbowDownLeftIcon size={12} />
        </button>
      </div>
    </form>
  );
}
