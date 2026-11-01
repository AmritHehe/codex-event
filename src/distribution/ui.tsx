"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";

// Shared pieces for the hub's sheets, so every tool reads like the index.
export const mono = "font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums";
export const label = `${mono} text-muted`;
export const note = "font-mono text-[11px] leading-relaxed text-muted";
export const field =
  "block w-full min-w-0 rounded-[6px] border border-line bg-canvas px-3.5 py-2.5 text-[14px] leading-[1.5] focus:border-ink disabled:opacity-50";
export const primary = "press h-11 rounded-md bg-ink px-5 text-[14px] font-medium text-canvas disabled:bg-faint";
export const secondary = "press h-11 rounded-md border border-line px-4 text-[14px] font-medium text-ink hover:border-ink disabled:opacity-40";
export const small = "press h-7 rounded-md border border-line px-2.5 font-mono text-[11px] tracking-[0.08em] uppercase text-ink hover:border-ink disabled:opacity-40";
export const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-6">
      <dt className={`${label} pt-0.5`}>{name}</dt>
      <dd className="min-w-0 text-[14px] leading-[1.6] text-ink">{children}</dd>
    </div>
  );
}

/** Sheet header: mono slug, display title, one line of context. `back` returns to the sheet that opened this one. */
export function SheetHead({ slug, title, back, children }: { slug: React.ReactNode; title: string; back?: () => void; children?: React.ReactNode }) {
  return (
    <>
      <p className={`${label} flex items-center gap-3 pr-12`}>
        {back && (
          <button onClick={back} className={`${mono} press -my-2.5 -ml-1 flex h-9 items-center gap-1.5 rounded-md px-1 text-ink hover:bg-hover`}>
            <ArrowLeftIcon size={14} />
            Back
          </button>
        )}
        <span className="min-w-0 truncate">{slug}</span>
      </p>
      <h2 className="mt-10 text-[clamp(32px,6vw,44px)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance">{title}</h2>
      {children && <div className="mt-4 max-w-[52ch] text-[16px] leading-[1.55] text-muted">{children}</div>}
    </>
  );
}

/** Indeterminate progress on a hairline: the one moving thing while a request runs. */
export function Working({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2" role="status">
      <span className={label}>{children}</span>
      <span className="relative block h-px overflow-hidden bg-line">
        <motion.span
          className="absolute inset-y-0 left-0 w-1/4 bg-accent"
          initial={{ x: "-100%" }}
          animate={{ x: "400%" }}
          transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
        />
      </span>
    </div>
  );
}

export function Alert({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="border-l-2 border-accent py-1 pl-4">
      <p className="text-[14px] font-medium">{title}</p>
      {children && <div className="mt-1 font-mono text-[12px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

/** Status pill. `on` is the live state and takes the accent; everything else stays ink or faint. */
export function Chip({ tone, children }: { tone: "on" | "ink" | "off"; children: React.ReactNode }) {
  const tones = { on: "border-accent bg-accent-soft text-ink", ink: "border-ink text-ink", off: "border-line text-muted" };
  return <span className={`${mono} inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

/** Radio group drawn as a segmented hairline control. Arrow keys move, as a native radio group would. */
export function Segmented<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex max-w-full self-start overflow-x-auto rounded-md border border-line p-0.5">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (i + step + options.length) % options.length;
              onChange(options[next].value);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}
            className={`${mono} h-7 rounded-[4px] px-2.5 whitespace-nowrap transition-colors duration-150 ${on ? "bg-ink text-canvas" : "text-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
