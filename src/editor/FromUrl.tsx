"use client";

import { LinkSimpleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { UrlForm } from "@/landing/Form";
import { useEditor } from "./store";
import { Button, Label, POP, useDismiss } from "./ui";

/** Start a new draft from a product URL without leaving the Studio. Replaces the project as one undoable step. */
export function FromUrlMenu() {
  const { edit } = useEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, useCallback(() => setOpen(false), []));

  return (
    <div ref={ref} className="relative">
      <Button aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <LinkSimpleIcon size={14} />
        <span className="max-sm:hidden">From URL</span>
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="New video from URL"
            {...POP}
            style={{ transformOrigin: "top right" }}
            className="absolute top-9 right-0 z-40 w-[min(380px,calc(100vw-24px))] rounded-[10px] border border-line bg-panel shadow-pop"
          >
            <div className="flex h-9 items-center border-b border-line px-3">
              <Label className="text-ink">New video from URL</Label>
            </div>
            <div className="p-3">
              <UrlForm
                compact
                onDone={(project) => {
                  edit(() => project, undefined, { sceneId: project.scenes[0].id, layerId: null });
                  setOpen(false);
                }}
              />
              <p className="mt-2.5 text-[12px] leading-snug text-muted">Replaces the current video. Undo brings it back.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
