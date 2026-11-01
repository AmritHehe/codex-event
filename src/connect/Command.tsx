"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";

/**
 * A terminal line (or two) with a copy button. `secret` is masked on screen but copied in full.
 * If the Clipboard API is blocked (http, permissions) the text is selected so the user can press ⌘C.
 */
export function Command({
  title,
  lines,
  secret,
  prompt = "$",
  size = "lg",
}: {
  title: string;
  lines: string[];
  secret?: string | null;
  prompt?: string;
  size?: "lg" | "md";
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "manual">("idle");
  const [reveal, setReveal] = useState(false);
  const code = useRef<HTMLElement>(null);
  const text = lines.join("\n");
  const mask = (s: string) => (secret && !reveal ? s.replaceAll(secret, `${secret.slice(0, 4)}${"•".repeat(12)}${secret.slice(-4)}`) : s);

  useEffect(() => {
    if (copied === "idle") return;
    const t = setTimeout(() => setCopied("idle"), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setReveal(true); // what gets selected must be the real thing
      requestAnimationFrame(() => {
        if (!code.current) return;
        const range = document.createRange();
        range.selectNodeContents(code.current);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      });
      setCopied("manual");
    }
  }

  return (
    <figure className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-panel">
      <figcaption className="flex h-10 items-center gap-3 border-b border-line pr-1.5 pl-3.5">
        <span className={`${LABEL} min-w-0 truncate`}>{title}</span>
        <span className="ml-auto flex items-center gap-1">
          {secret && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-pressed={reveal}
              aria-label={reveal ? "Hide token" : "Show token"}
              className="press h-7 rounded-[6px] px-2.5 font-mono text-[11px] tracking-[0.08em] whitespace-nowrap text-muted uppercase hover:bg-hover hover:text-ink"
            >
              {reveal ? "Hide" : "Show"}
              <span className="max-sm:hidden"> token</span>
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy: ${title}`}
            className={`press inline-flex h-7 min-w-[86px] items-center justify-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors ${
              copied === "ok" ? "bg-accent-soft text-ink" : "bg-ink text-canvas hover:bg-ink/85"
            }`}
          >
            {copied === "ok" ? <CheckIcon size={14} weight="bold" className="text-accent" /> : <CopyIcon size={14} />}
            {copied === "ok" ? "Copied" : copied === "manual" ? "Press ⌘C" : "Copy"}
          </button>
        </span>
      </figcaption>
      <pre className={`overflow-hidden px-3.5 py-4 font-mono leading-[1.6] text-ink md:px-5 md:py-5 ${size === "lg" ? "text-[13px] md:text-[15px]" : "text-[13px] md:text-[14px]"}`}>
        <code ref={code} className="block">
          {lines.map((l, i) => (
            <span key={i} className="flex gap-3">
              <span aria-hidden className="shrink-0 text-faint select-none">
                {prompt}
              </span>
              <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{mask(l)}</span>
            </span>
          ))}
        </code>
      </pre>
      <span role="status" className="sr-only">
        {copied === "ok" ? "Copied to clipboard" : copied === "manual" ? "Copy is blocked here. The command is selected: press Command C." : ""}
      </span>
    </figure>
  );
}
