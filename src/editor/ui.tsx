"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { FPS } from "@/video/schema";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Broadcast timecode HH:MM:SS:FF. */
export const tc = (frame: number) => {
  const f = Math.max(0, Math.round(frame));
  const s = Math.floor(f / FPS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f % FPS)}`;
};

export const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Close a popover on outside pointer or Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}

export const POP = {
  initial: { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
  animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
  exit: { opacity: 0, transform: "translateY(-2px) scale(0.99)", transition: { duration: 0.1 } },
  transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const },
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cx(
        "press inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap disabled:opacity-40",
        variant === "primary" && "bg-ink text-canvas hover:bg-ink/85",
        variant === "secondary" && "border border-line bg-panel text-ink hover:border-[#cfcfcb] hover:bg-hover/60",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-ink",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cx("press grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent", className)}
    />
  );
}

/** Mono uppercase label: the only heading style inside the tool. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted uppercase", className)}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[4px] border border-line bg-panel px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}

/** Inline row: label column + control. `stack` puts the label above (text areas). */
export function Field({ label, hint, stack, children }: { label: string; hint?: string; stack?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={cx("grid gap-x-3 gap-y-1.5", stack ? "grid-cols-1" : "grid-cols-[76px_minmax(0,1fr)] items-center")}>
      <label htmlFor={id} className="truncate text-[12px] text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className={cx("text-[11px] leading-snug text-muted", !stack && "col-start-2")}>{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full min-w-0 rounded-md border border-line bg-white/70 px-2 text-[12.5px] text-ink outline-none placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-[#cfcfcb] focus:border-accent focus:bg-white focus:shadow-[0_0_0_3px_var(--color-accent-soft)] focus-visible:outline-none!";

export function TextInput({ unit, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unit?: string }) {
  const input = <input {...props} className={cx(inputCls, "h-7", props.type === "number" && "font-mono tabular-nums", unit && "pr-7", props.className)} />;
  if (!unit) return input;
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[11px] text-faint">{unit}</span>
    </div>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, "resize-y py-1.5 leading-relaxed", props.className)} />;
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: readonly T[] | { value: T; label: string }[]; onChange: (v: T) => void }) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ") } : o));
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, "h-7 appearance-none pr-7")}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDownIcon size={11} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, mono }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; mono?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-7 rounded-md border border-line bg-canvas p-px">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cx(
            "press flex-1 rounded-[5px] px-2 text-[12px] whitespace-nowrap",
            mono ? "font-mono text-[11px] tabular-nums" : "font-medium capitalize",
            o === value ? "bg-white text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(24_24_27/0.06)]" : "text-muted hover:text-ink",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ id, checked, onChange }: { id?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx("relative h-4 w-7 rounded-full transition-colors duration-200 motion-reduce:transition-none", checked ? "bg-ink" : "bg-line")}
    >
      <span
        className="absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
        style={{ transform: checked ? "translateX(12px)" : "none" }}
      />
    </button>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="group grid h-7 cursor-pointer grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
      <span className="truncate text-[12px] text-muted">{label}</span>
      <span className="flex h-7 items-center gap-2 rounded-md border border-line bg-white/70 px-1 group-hover:border-[#cfcfcb]">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-[18px] shrink-0 cursor-pointer" aria-label={label} />
        <span className="font-mono text-[11px] tracking-wide text-ink uppercase">{value.replace("#", "")}</span>
      </span>
    </label>
  );
}

/** Panel section header: mono label, optional count and action. */
export function PanelTitle({ children, meta, action }: { children: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 pr-1.5 pl-3">
      <h2>
        <Label className="text-ink">{children}</Label>
      </h2>
      {meta && <span className="font-mono text-[10.5px] text-faint tabular-nums">{meta}</span>}
      <span className="ml-auto">{action}</span>
    </div>
  );
}

/** Inspector block separated by a hairline. */
export function Section({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-line px-3 pt-3 pb-4">
      <div className="flex h-5 items-center justify-between">
        <h3>
          <Label className="text-ink">{title}</Label>
        </h3>
        {meta && <span className="font-mono text-[10.5px] text-muted tabular-nums">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
