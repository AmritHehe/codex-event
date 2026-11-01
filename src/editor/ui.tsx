"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cx(
        "press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap disabled:opacity-40",
        variant === "primary" && "bg-ink text-white hover:bg-ink/85",
        variant === "secondary" && "bg-panel text-ink shadow-panel hover:bg-hover",
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
      className={cx("press grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink disabled:opacity-30", className)}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg bg-white px-2.5 text-[13px] text-ink shadow-panel outline-none placeholder:text-faint transition-shadow duration-150 focus:shadow-[0_0_0_1px_var(--color-accent),0_0_0_4px_var(--color-accent-soft)]";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, "h-8", props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, "resize-y py-2 leading-relaxed", props.className)} />;
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: readonly T[] | { value: T; label: string }[]; onChange: (v: T) => void }) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ") } : o));
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, "h-8 appearance-none pr-8")}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDownIcon size={12} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-hover p-0.5">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cx(
            "press h-7 flex-1 rounded-md px-2.5 text-[12px] font-medium capitalize",
            o === value ? "bg-white text-ink shadow-panel" : "text-muted hover:text-ink",
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
      className={cx("relative h-5 w-9 rounded-full transition-colors duration-200", checked ? "bg-accent" : "bg-line")}
    >
      <span
        className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)]"
        style={{ transform: checked ? "translateX(16px)" : "none" }}
      />
    </button>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-white p-1 pr-2 shadow-panel">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer" aria-label={label} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{label}</span>
      <span className="font-mono text-[11px] text-ink uppercase">{value.replace("#", "")}</span>
    </label>
  );
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between px-3">
      <h2 className="text-[12px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
