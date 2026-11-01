"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { generateRequest, generateResponse, postJson } from "@/lib/contracts";
import { FPS, type Project } from "@/video/schema";
import { LABEL, tc } from "./client";
import css from "./landing.module.css";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

/** Elapsed time while the draft is generated, as a running timecode. No fake steps: we don't know them. */
function Generating() {
  const reduce = useReducedMotion();
  const out = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      if (out.current) out.current.textContent = tc(((performance.now() - t0) / 1000) * FPS);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div role="status" className="mt-3">
      <div aria-hidden className={`relative h-5 overflow-hidden border-y border-line ${css.fine}`}>
        {!reduce && (
          <motion.div
            className="absolute inset-y-0 right-px left-0"
            initial={{ transform: "translateX(0%)" }}
            animate={{ transform: "translateX(100%)" }}
            transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
          >
            <span className="absolute inset-y-0 left-0 w-px bg-accent" />
          </motion.div>
        )}
      </div>
      <p className={`mt-2 flex justify-between ${LABEL}`}>
        <span>Reading your page and writing scenes</span>
        <span ref={out} className="text-ink tabular-nums">
          {tc(0)}
        </span>
      </p>
    </div>
  );
}

/** F3.1: product URL in, first draft out. Landing hands it to the Studio; inside the Studio, `onDone` loads it directly. */
/** `quiet`: secondary button when a stronger CTA sits above it (the hero's "Connect your agent"). */
export function UrlForm({ onDone, compact = false, quiet = false }: { onDone?: (project: Project) => void; compact?: boolean; quiet?: boolean } = {}) {
  const id = useId();
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const loading = status.kind === "loading";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("url") ?? "").trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!raw || !generateRequest.safeParse({ url }).success) {
      setStatus({ kind: "error", message: "Enter your product's address, like https://yourproduct.com" });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await postJson("/api/generate", { url }, generateResponse);
      if (onDone) {
        setStatus({ kind: "idle" });
        onDone(result.project);
        return;
      }
      try {
        localStorage.setItem("shipcast:project", JSON.stringify(result.project));
      } catch {
        // Storage can be full or blocked; the Studio still opens.
      }
      router.push("/studio");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
  }

  return (
    <div>
      <form onSubmit={submit} noValidate aria-busy={loading}>
        <label htmlFor={`${id}-url`} className={`${LABEL} mb-2 block`}>
          Paste your product URL
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id={`${id}-url`}
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourproduct.com"
            disabled={loading}
            aria-invalid={status.kind === "error"}
            aria-describedby={status.kind === "error" ? `${id}-err` : undefined}
            onChange={() => status.kind === "error" && setStatus({ kind: "idle" })}
            className={`${compact ? "h-9 text-[14px]" : "h-12 text-[16px]"} w-full min-w-0 rounded-[6px] border border-line bg-panel px-3.5 transition-colors outline-none placeholder:text-faint hover:border-faint focus:border-ink disabled:opacity-60 aria-invalid:border-accent`}
          />
          <button
            type="submit"
            disabled={loading}
            className={`${compact ? "h-9 text-[13px]" : "h-12 text-[15px]"} press group inline-flex items-center justify-center gap-2 rounded-[6px] px-4 font-medium disabled:opacity-60 md:px-5 ${quiet ? "border border-ink/80 text-ink hover:bg-ink hover:text-canvas" : "bg-ink text-canvas"}`}
          >
            {loading ? "Generating" : "Make the video"}
            <ArrowRightIcon size={15} weight="bold" className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
          </button>
        </div>
        {loading && <Generating />}
        {status.kind === "error" && (
          <p id={`${id}-err`} role="alert" className="mt-2.5 flex gap-2 text-[14px] leading-snug text-ink">
            <span className="font-mono text-[11px] leading-[20px] tracking-[0.08em] text-accent uppercase">Err</span>
            {status.message}
          </p>
        )}
      </form>
      {!compact && (
      <p className="mt-5 text-[14px] text-muted">
        No URL handy?{" "}
        <Link href="/studio" className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink">
          Open Studio
        </Link>{" "}
        with the sample launch video.
      </p>
      )}
    </div>
  );
}
