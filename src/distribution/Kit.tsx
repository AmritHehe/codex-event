"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { kitResponse, postJson } from "@/lib/contracts";
import { sampleProject } from "@/video/sample";
import { projectSchema, type Project } from "@/video/schema";
import { CHANNELS } from "./channels";
import { ChannelLogo } from "./icons";

const label = "font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums text-muted";
const byId = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

/** The Studio autosaves here; fall back to the sample so the kit always has a source. */
function loadProject(): { project: Project; saved: boolean } {
  try {
    const raw = localStorage.getItem("shipcast:project");
    const parsed = raw ? projectSchema.safeParse(JSON.parse(raw)) : null;
    if (parsed?.success) return { project: parsed.data, saved: true };
  } catch {
    // blocked or corrupt storage: use the sample
  }
  return { project: sampleProject, saved: false };
}

type Draft = { channelId: string; text: string };
type KitState = { status: "idle" | "pending" | "done" | "error"; error?: string; drafts: Draft[] };

export function useKit() {
  const [s, setS] = useState<KitState>({ status: "idle", drafts: [] });
  const run = useRef(0);

  const generate = async (channels: string[]) => {
    const id = ++run.current;
    setS((p) => ({ ...p, status: "pending", error: undefined }));
    try {
      const { posts } = await postJson("/api/kit", { project: loadProject().project, channels }, kitResponse);
      if (id !== run.current) return;
      const tags = (h?: string[]) => h?.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
      setS({ status: "done", drafts: posts.map((p) => ({ channelId: p.channelId, text: [p.text, tags(p.hashtags)].filter(Boolean).join("\n\n") })) });
    } catch (e) {
      if (id !== run.current) return;
      setS((p) => ({ ...p, status: "error", error: e instanceof Error ? e.message : "Unknown error" }));
    }
  };
  const edit = (channelId: string, text: string) => setS((p) => ({ ...p, drafts: p.drafts.map((d) => (d.channelId === channelId ? { ...d, text } : d)) }));

  return { ...s, generate, edit };
}

export type Kit = ReturnType<typeof useKit>;

function CopyButton({ text, name }: { text: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => {},
        )
      }
      aria-label={`Copy ${name} draft`}
      className={`press h-7 rounded-md border px-2.5 font-mono text-[11px] tracking-[0.08em] uppercase ${copied ? "border-ink bg-ink text-canvas" : "border-line text-ink hover:border-ink"}`}
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function KitSheet({ picked, kit, onRemove }: { picked: string[]; kit: Kit; onRemove: (id: string) => void }) {
  const [{ project, saved }] = useState(loadProject);
  const pending = kit.status === "pending";

  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <p className={label}>Kit · {String(picked.length).padStart(2, "0")} channels</p>
      <h2 className="mt-10 text-[clamp(32px,6vw,44px)] leading-[0.95] font-semibold tracking-[-0.045em]">Launch kit</h2>
      <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.55] text-muted">
        One post per channel, written from {saved ? "your Studio project" : "the sample project"} <span className="text-ink">{project.name}</span>. Edit each draft,
        then copy it out.
      </p>

      <ul className="mt-8 border-t border-line">
        {picked.map((id) => {
          const c = byId[id];
          return (
            <li key={id} className="flex items-center gap-3 border-b border-line py-3">
              <ChannelLogo c={c} size={16} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{c.name}</span>
              <button
                onClick={() => onRemove(id)}
                aria-label={`Remove ${c.name} from kit`}
                className="press grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
              >
                <XIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {!picked.length && <p className="border-b border-line py-6 text-[14px] text-muted">Tick channels in the index to add them here.</p>}

      <button
        onClick={() => kit.generate(picked)}
        disabled={!picked.length || pending}
        className="press mt-6 h-11 self-start rounded-md bg-ink px-5 text-[14px] font-medium text-canvas disabled:bg-faint"
      >
        {pending ? "Writing posts" : kit.status === "done" ? "Generate again" : `Generate ${picked.length} ${picked.length === 1 ? "post" : "posts"}`}
      </button>

      <div aria-live="polite" className="mt-6">
        {pending && (
          <div className="flex flex-col gap-2">
            <span className={label}>Writing {picked.length} drafts</span>
            <span className="relative block h-px overflow-hidden bg-line">
              <motion.span
                className="absolute inset-y-0 left-0 w-1/4 bg-accent"
                initial={{ x: "-100%" }}
                animate={{ x: "400%" }}
                transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
              />
            </span>
          </div>
        )}
        {kit.status === "error" && (
          <div role="alert" className="border-l-2 border-accent py-1 pl-4">
            <p className="text-[14px] font-medium">The kit could not be generated.</p>
            <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">{kit.error}</p>
          </div>
        )}
      </div>

      {kit.status !== "pending" && kit.drafts.length > 0 && (
        <section aria-label="Drafts" className="mt-4 flex flex-col gap-8 border-t border-line pt-5">
          <p className={label}>Drafts · {String(kit.drafts.length).padStart(2, "0")}</p>
          {kit.drafts.map((d) => {
            const c = byId[d.channelId];
            const name = c?.name ?? d.channelId;
            return (
              <div key={d.channelId} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  {c && <ChannelLogo c={c} size={16} />}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{name}</span>
                  <span className={label}>{d.text.length} chars</span>
                  <CopyButton text={d.text} name={name} />
                </div>
                <textarea
                  value={d.text}
                  onChange={(e) => kit.edit(d.channelId, e.target.value)}
                  aria-label={`${name} draft`}
                  style={{ outline: "none" }}
                  className="min-h-[120px] w-full resize-none rounded-[6px] border border-line bg-canvas px-3.5 py-3 text-[14px] leading-[1.55] [field-sizing:content] focus:border-ink"
                />
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/** Checkbox drawn to match the index: hairline box, accent when ticked. */
export function Tick({ checked, onChange, name }: { checked: boolean; onChange: () => void; name: string }) {
  return (
    <span className="relative z-[1] grid size-4 place-items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={`Add ${name} to kit`}
        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-faint bg-panel transition-colors duration-150 checked:border-accent checked:bg-accent hover:border-ink checked:hover:border-accent"
      />
      <CheckIcon size={11} weight="bold" className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" />
    </span>
  );
}
