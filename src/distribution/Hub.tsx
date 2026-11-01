"use client";

import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PUBLISH_CHANNELS } from "@/lib/distribution-contracts";
import { AGENTS, type AgentId } from "./agents";
import { ASSET_LABEL, AUTOMATION, CATEGORIES, CHANNELS, type Automation, type CategoryId, type Channel } from "./channels";
import { AgentGlyph, ChannelLogo } from "./icons";
import { KitSheet, Tick, useKit } from "./Kit";
import { MemeSheet } from "./MemeAgent";
import { QueueSheet, isCommunity, useCommunityQueue } from "./CommunityQueue";
import { ConnectionsSheet, PublishSheet, connectionSummary, isPublishable, usePublishing, type PublishId } from "./Publisher";
import { Fact, label, mono, note, pad } from "./ui";

const EASE_UI = [0.23, 1, 0.32, 1] as const;
const EASE_ENTER = [0.16, 1, 0.3, 1] as const;
const LEVELS: Automation[] = ["full", "assisted", "manual"];
const RESEARCHED = "2026-11-01";

const CH_NO = Object.fromEntries(CHANNELS.map((c, i) => [c.id, pad(i + 1, 3)]));
const AGENT_NO = Object.fromEntries(AGENTS.map((a, i) => [a.id, pad(i + 1)])) as Record<AgentId, string>;
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<CategoryId, string>;
const short = (name: string) => name.replace(/ agent$/, "");


type Filters = { category: CategoryId | null; automation: Automation | null; agent: AgentId | null; q: string };
const NO_FILTERS: Filters = { category: null, automation: null, agent: null, q: "" };

/** `skip` ignores one facet so its own counts show what selecting it would give. */
function matches(c: Channel, f: Filters, skip?: keyof Filters) {
  const q = f.q.trim().toLowerCase();
  return (
    (skip === "category" || !f.category || c.category === f.category) &&
    (skip === "automation" || !f.automation || c.automation === f.automation) &&
    (skip === "agent" || !f.agent || c.agent === f.agent) &&
    (!q || `${c.name} ${c.what} ${CATEGORY[c.category]}`.toLowerCase().includes(q))
  );
}

/** Signal-strength meter: three bars for auto-post, two for drafts, one for manual. */
export function Meter({ a, text = true }: { a: Automation; text?: boolean }) {
  const n = 3 - LEVELS.indexOf(a);
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="flex items-end gap-[2px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-[3px] ${["h-1.5", "h-2", "h-2.5"][i]} ${i < n ? (a === "full" ? "bg-accent" : "bg-ink") : "bg-line"}`} />
        ))}
      </span>
      {text && <span className={`${label} whitespace-nowrap text-ink`}>{AUTOMATION[a].label}</span>}
    </span>
  );
}

/** One tick per channel in catalog order; matching ticks stay inked. */
function Ruler({ shown }: { shown: Set<string> }) {
  return (
    <div aria-hidden className="flex h-4 items-end justify-between">
      {CHANNELS.map((c, i) => (
        <span
          key={c.id}
          className={`w-px sm:w-[2px] ${i % 10 === 0 ? "h-3.5" : "h-2"} ${!shown.has(c.id) ? "bg-line" : c.automation === "full" ? "bg-accent" : "bg-ink"}`}
        />
      ))}
    </div>
  );
}

function IndexButton({ on, dim, onClick, children }: { on: boolean; dim: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`relative flex w-full items-baseline gap-3 py-2.5 pr-8 text-left whitespace-nowrap transition-colors duration-150 lg:pr-0 ${
        on ? "text-ink" : dim ? "text-faint hover:text-muted" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      {on && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-accent lg:inset-y-2 lg:right-auto lg:-left-3 lg:h-auto lg:w-[2px]" />}
    </button>
  );
}

/** Text button for the top bar: the workspace's tools sit beside the timecode, not in the reading flow. */
function BarButton({ onClick, children }: { onClick: (keyboard: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => onClick(e.detail === 0)}
      className={`${mono} press flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-ink transition-colors duration-150 hover:bg-hover`}
    >
      {children}
    </button>
  );
}

/** An agent's working surface, linked from its track header. */
function ToolLink({ onClick, children }: { onClick: (keyboard: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => onClick(e.detail === 0)}
      className={`${mono} group mt-3 inline-flex items-center gap-1.5 text-ink underline decoration-line underline-offset-4 hover:decoration-ink`}
    >
      {children}
      <ArrowRightIcon size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  );
}

const strip = "-mx-4 flex overflow-x-auto px-4 [scrollbar-width:none] md:-mx-10 md:px-10 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0";

function Row({ c, onOpen, picked, onPick }: { c: Channel; onOpen: (c: Channel, keyboard: boolean) => void; picked: boolean; onPick: () => void }) {
  const assets = c.assets.map((a) => ASSET_LABEL[a]);
  return (
    <li
      className={`relative -mx-2 grid grid-cols-[16px_20px_minmax(0,1fr)] items-start gap-x-3 border-b border-line px-2 py-4 md:grid-cols-[16px_36px_20px_minmax(0,1fr)_150px_124px] md:items-center md:gap-x-4 xl:grid-cols-[16px_36px_20px_minmax(0,1fr)_150px_190px_124px] ${picked ? "bg-accent-soft" : "hover:bg-panel"}`}
    >
      <span className="pt-0.5 md:pt-0">
        <Tick checked={picked} onChange={onPick} name={c.name} />
      </span>
      <span className={`${label} hidden md:block`}>{CH_NO[c.id]}</span>
      <span className="pt-0.5 md:pt-0">
        <ChannelLogo c={c} size={18} />
      </span>
      <div className="min-w-0">
        <button
          onClick={(e) => onOpen(c, e.detail === 0)}
          className="text-left text-[15px] leading-tight font-medium tracking-[-0.01em] after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset"
          style={{ outline: "none" }}
        >
          {c.name}
        </button>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted md:truncate">{c.what}</p>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 md:hidden">
          <Meter a={c.automation} />
          <span className={label}>{CATEGORY[c.category]}</span>
        </p>
      </div>
      <span className={`${label} hidden truncate md:block`}>{CATEGORY[c.category]}</span>
      <span className={`${label} hidden truncate xl:block`} title={assets.join(", ")}>
        {assets.slice(0, 2).join(" · ")}
        {assets.length > 2 && <span className="text-faint"> +{assets.length - 2}</span>}
      </span>
      <span className="hidden md:block">
        <Meter a={c.automation} />
      </span>
    </li>
  );
}

const slide = {
  hidden: (instant: boolean) => ({ x: "100%", transition: { duration: instant ? 0 : 0.18, ease: EASE_UI } }),
  shown: (instant: boolean) => ({ x: "0%", transition: { duration: instant ? 0 : 0.26, ease: EASE_UI } }),
};
const fade = {
  hidden: (instant: boolean) => ({ opacity: 0, transition: { duration: instant ? 0 : 0.18 } }),
  shown: (instant: boolean) => ({ opacity: 1, transition: { duration: instant ? 0 : 0.22 } }),
};

/** Right-hand sheet. Esc closes, Tab stays inside, focus returns to the opener. */
export function Drawer({ title, wide, instant, onClose, children }: { title: string; wide?: boolean; instant: boolean; onClose: (keyboard: boolean) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);
  // Moving between sheets inside the drawer starts the next one at the top, with focus on the dialog.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    ref.current?.focus();
  }, [title]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose(true);
    if (e.key !== "Tab" || !ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>("button:not(:disabled):not([tabindex='-1']), textarea, input, select, a[href]");
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <motion.div custom={instant} variants={fade} initial="hidden" animate="shown" exit="hidden" className="fixed inset-0 z-30 bg-ink/15" onClick={() => onClose(false)} />
      <motion.aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        custom={instant}
        variants={slide}
        initial="hidden"
        animate="shown"
        exit="hidden"
        className={`fixed inset-y-0 right-0 z-40 flex ${wide ? "w-[min(1000px,100vw)]" : "w-[min(520px,100vw)]"} flex-col overflow-y-auto overscroll-contain border-l border-line bg-panel shadow-pop`}
        style={{ outline: "none" }}
      >
        <button
          onClick={(e) => onClose(e.detail === 0)}
          aria-label="Close"
          className="press absolute top-4 right-4 grid size-9 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
        >
          <XIcon size={18} />
        </button>
        {children}
      </motion.aside>
    </>
  );
}

function ChannelSheet({ c, picked, onPick, actions }: { c: Channel; picked: boolean; onPick: () => void; actions?: React.ReactNode }) {
  const agent = AGENTS.find((a) => a.id === c.agent)!;
  return (
    <div className="flex flex-col px-6 pt-6 pb-10 sm:px-8">
      <p className={label}>
        CH {CH_NO[c.id]} · {CATEGORY[c.category]}
      </p>
      <div className="mt-10 flex items-center gap-3 text-ink">
        <ChannelLogo c={c} size={28} />
      </div>
      <h2 className="mt-4 text-[clamp(32px,6vw,44px)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance">{c.name}</h2>
      <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.55] text-muted">{c.what}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={onPick}
          aria-pressed={picked}
          className={`press flex h-10 items-center gap-2.5 rounded-md border px-4 text-[14px] font-medium ${picked ? "border-accent bg-accent-soft text-ink" : "border-ink text-ink hover:bg-ink hover:text-canvas"}`}
        >
          {picked ? <CheckIcon size={15} weight="bold" className="text-accent" /> : <PlusIcon size={15} />}
          {picked ? "In your kit" : "Add to kit"}
        </button>
        {actions}
      </div>
      <dl className="mt-8 border-b border-line">
        <Fact name="Automation">
          <Meter a={c.automation} />
          <span className="mt-2 block text-muted">{AUTOMATION[c.automation].explain}</span>
        </Fact>
        <Fact name={`TRK ${AGENT_NO[agent.id]}`}>
          <span className="flex items-center gap-2 font-medium">
            <AgentGlyph id={agent.id} />
            {agent.name}
          </span>
          <span className="mt-1 block text-muted">{c.agentDoes}</span>
        </Fact>
        <Fact name="Connects">{c.api}</Fact>
        <Fact name="What works">{c.tip}</Fact>
        <Fact name="Assets">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {c.assets.map((a) => (
              <span key={a} className={`${mono} text-ink`}>
                {ASSET_LABEL[a]}
              </span>
            ))}
          </span>
        </Fact>
      </dl>
      <p className={`${note} mt-6`}>Researched {RESEARCHED}. Platform rules change often, so check before you rely on one.</p>
    </div>
  );
}

/** What the drawer shows. Tools opened from another sheet remember it, so Back returns there. */
type Panel =
  | { kind: "channel"; c: Channel }
  | { kind: "kit" }
  | { kind: "connections"; back?: Panel }
  | { kind: "publish"; id: PublishId; back?: Panel }
  | { kind: "meme" }
  | { kind: "queue"; focus?: string; back?: Panel };

const BYID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
const panelTitle = (p: Panel): string =>
  p.kind === "channel" ? p.c.name : p.kind === "kit" ? "Launch kit" : p.kind === "connections" ? "Connections" : p.kind === "meme" ? "Meme composer" : p.kind === "queue" ? "Community queue" : `Publish to ${BYID[p.id].name}`;
const backLabel = (p?: Panel) => (!p ? undefined : p.kind === "kit" ? "Back to kit" : p.kind === "channel" ? `Back to ${p.c.name}` : "Back");

export function Hub() {
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<Panel | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const kit = useKit();
  const pub = usePublishing();
  const queue = useCommunityQueue();
  const [instant, setInstant] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));

  const shown = CHANNELS.filter((c) => matches(c, f));
  const shownIds = new Set(shown.map((c) => c.id));
  const filtered = f.category || f.automation || f.agent || f.q;
  const count = (a: Automation) => CHANNELS.filter((c) => c.automation === a).length;

  const show = (panel: Panel, keyboard: boolean) => {
    setInstant(keyboard);
    setOpen(panel);
  };
  // Kept in catalog order so the kit reads like the index.
  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : CHANNELS.map((c) => c.id).filter((x) => x === id || p.includes(x))));
  const generate = (keyboard: boolean) => {
    show({ kind: "kit" }, keyboard);
    if (kit.status === "idle") kit.generate(picked);
  };
  const close = (keyboard: boolean) => {
    setInstant(keyboard);
    setOpen(null);
  };

  /** The channel sheet's second action: hand-posted communities go to the queue, API channels to publishing. */
  const channelAction = (from: Panel & { kind: "channel" }) => {
    const id = from.c.id;
    const style = "press flex h-10 items-center gap-2 rounded-md border border-line px-4 text-[14px] font-medium hover:border-ink disabled:opacity-40";
    if (isCommunity(id))
      return (
        <button
          onClick={() => setOpen({ kind: "queue", focus: queue.add(id, kit.drafts.find((d) => d.channelId === id)?.text), back: from })}
          disabled={!queue.ready}
          className={style}
        >
          Add to community queue
          <ArrowRightIcon size={14} />
        </button>
      );
    if (isPublishable(id))
      return (
        <button onClick={() => setOpen({ kind: "publish", id, back: from })} className={style}>
          Publish to {from.c.name}
          <ArrowUpRightIcon size={14} />
        </button>
      );
    return null;
  };

  // "/" jumps to search from anywhere outside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1440px] px-4 pb-32 md:px-10">
        <div className={`${label} flex items-center justify-between gap-4 border-b border-line py-1.5`}>
          <span className="hidden sm:inline">Distribution</span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:flex-none">
            <span className="mr-3 hidden lg:inline">
              CH 001 to {pad(CHANNELS.length, 3)} · TRK 01 to {pad(AGENTS.length)}
            </span>
            <BarButton onClick={(keyboard) => show({ kind: "connections" }, keyboard)}>
              Connections
              {connectionSummary(pub) && <span className="text-accent">{connectionSummary(pub)}</span>}
            </BarButton>
            <BarButton onClick={(keyboard) => show({ kind: "meme" }, keyboard)}>Meme</BarButton>
            <BarButton onClick={(keyboard) => show({ kind: "queue" }, keyboard)}>
              Queue <span className="text-muted">{pad(queue.drafts.length)}</span>
            </BarButton>
          </span>
        </div>

        <header className="grid gap-8 pt-12 pb-12 md:pt-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end lg:gap-16 lg:pb-16">
          <h1 className="text-[clamp(44px,9.4vw,160px)] leading-[0.88] font-semibold tracking-[-0.06em]">
            {[`${CHANNELS.length} channels.`, `${AGENTS.length} agents.`].map((t, i) => (
              <span key={t} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className={`block ${i ? "text-muted" : ""}`}
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.9, ease: EASE_ENTER, delay: 0.05 + i * 0.09 }}
                >
                  {t}
                </motion.span>
              </span>
            ))}
          </h1>
          <div className="flex max-w-[46ch] flex-col gap-5 lg:pb-3">
            <p className="text-[17px] leading-[1.55] text-ink">
              Workflow categories guide your connected agent; they are not background workers. {PUBLISH_CHANNELS.length} publishing adapters are available in Connections. {count("full")} platforms offer APIs, {count("assisted")} support drafts you
              approve, and {count("manual")} {count("manual") === 1 ? "stays" : "stay"} manual because the rules ban automation.
            </p>
            <p className={note}>Platform rules researched {RESEARCHED}. They change often, so check before you rely on one.</p>
          </div>
        </header>

        <div role="group" aria-label="Filter by automation" className="grid grid-cols-3 border-y border-line">
          {LEVELS.map((a, i) => {
            const on = f.automation === a;
            return (
              <button
                key={a}
                onClick={() => set({ automation: on ? null : a })}
                aria-pressed={on}
                className={`group relative flex min-w-0 flex-col items-start gap-4 py-5 text-left transition-colors duration-150 hover:bg-panel md:py-6 ${
                  i ? "border-l border-line pl-3 md:pl-6" : "pr-3"
                }`}
              >
                {on && <span className="absolute inset-x-0 -top-px h-[2px] bg-accent" />}
                <Meter a={a} text={false} />
                <span className="font-mono text-[clamp(30px,4.4vw,64px)] leading-none font-medium tracking-[-0.05em] tabular-nums">
                  {pad(CHANNELS.filter((c) => c.automation === a && matches(c, f, "automation")).length)}
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className={`${mono} ${on ? "text-ink" : "text-muted"}`}>{AUTOMATION[a].label}</span>
                  <span className="hidden max-w-[36ch] text-[13px] leading-snug text-muted md:block">{AUTOMATION[a].explain}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 pt-10 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-14 lg:pt-14">
          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-8 lg:gap-10 lg:self-start">
            <nav aria-label="Agents">
              <p className={`${label} flex justify-between border-b border-line pb-2.5`}>
                <span>Agents</span>
                <span>{pad(AGENTS.length)}</span>
              </p>
              <ul className={strip}>
                {AGENTS.map((a) => {
                  const n = CHANNELS.filter((c) => c.agent === a.id && matches(c, f, "agent")).length;
                  return (
                    <li key={a.id} className="shrink-0 lg:border-b lg:border-line">
                      <IndexButton on={f.agent === a.id} dim={!n} onClick={() => set({ agent: f.agent === a.id ? null : a.id })}>
                        <span className={`${mono}`}>{AGENT_NO[a.id]}</span>
                        <span className="text-[15px] font-medium tracking-[-0.01em]">{short(a.name)}</span>
                        <span className={`${mono} ml-auto`}>{pad(n)}</span>
                      </IndexButton>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <nav aria-label="Categories">
              <p className={`${label} flex justify-between border-b border-line pb-2.5`}>
                <span>Category</span>
                <span>{pad(CATEGORIES.length)}</span>
              </p>
              <ul className={strip}>
                {[{ id: null, label: "All" }, ...CATEGORIES].map((cat) => {
                  const n = CHANNELS.filter((c) => (!cat.id || c.category === cat.id) && matches(c, f, "category")).length;
                  return (
                    <li key={cat.label} className="shrink-0 lg:border-b lg:border-line">
                      <IndexButton on={f.category === cat.id} dim={!n} onClick={() => set({ category: cat.id })}>
                        <span className="text-[14px] tracking-[-0.005em]">{cat.label}</span>
                        <span className={`${mono} ml-auto`}>{pad(n)}</span>
                      </IndexButton>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="sticky top-0 z-20 -mx-4 bg-canvas px-4 pt-4 pb-3 md:-mx-10 md:px-10 lg:mx-0 lg:px-0">
              <label className="flex items-center gap-3 border-b border-ink pb-3 focus-within:border-accent">
                <MagnifyingGlassIcon size={20} className="shrink-0 text-muted" />
                <span className="sr-only">Search channels</span>
                <input
                  ref={search}
                  type="search"
                  value={f.q}
                  onChange={(e) => set({ q: e.target.value })}
                  placeholder={`Search ${CHANNELS.length} channels`}
                  className="min-w-0 flex-1 bg-transparent text-[20px] tracking-[-0.02em] outline-none placeholder:text-muted md:text-[24px] [&::-webkit-search-cancel-button]:hidden"
                  style={{ outline: "none" }}
                />
                <kbd className={`${label} hidden rounded-[4px] border border-line px-1.5 py-0.5 md:block`}>/</kbd>
              </label>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className={label} aria-live="polite">
                  {pad(shown.length, 3)} / {pad(CHANNELS.length, 3)} shown
                </span>
                {filtered && (
                  <button onClick={() => setF(NO_FILTERS)} className={`${mono} text-ink underline decoration-line underline-offset-4 hover:decoration-ink`}>
                    Clear filters
                  </button>
                )}
              </div>
              <div className="mt-3">
                <Ruler shown={shownIds} />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="flex flex-col items-start gap-3 border-b border-line py-16">
                <p className="text-[clamp(24px,3vw,36px)] font-semibold tracking-[-0.04em]">Nothing here.</p>
                <p className="text-[15px] text-muted">No channel matches every filter you set.</p>
                <button onClick={() => setF(NO_FILTERS)} className="press mt-2 h-9 rounded-md bg-ink px-4 text-[14px] font-medium text-canvas">
                  Clear filters
                </button>
              </div>
            ) : (
              AGENTS.map((a) => {
                const rows = shown.filter((c) => c.agent === a.id);
                if (!rows.length) return null;
                const total = CHANNELS.filter((c) => c.agent === a.id).length;
                return (
                  <section key={a.id} aria-labelledby={`trk-${a.id}`} className="pt-12 first:pt-6">
                    <header className="grid gap-x-10 gap-y-3 border-b border-ink pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
                      <div>
                        <p className={label}>
                          TRK {AGENT_NO[a.id]} · {rows.length === total ? `${pad(total)} ch` : `${pad(rows.length)} of ${pad(total)} ch`}
                        </p>
                        <h2 id={`trk-${a.id}`} className="mt-3 text-[clamp(28px,3.4vw,44px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                          {a.name}
                        </h2>
                      </div>
                      <div className="text-[14px] leading-[1.55]">
                        <p className="text-ink">{a.role}</p>
                        <p className="mt-1 hidden text-muted md:block">{a.does.join(". ")}.</p>
                        {a.id === "meme" && (
                          <ToolLink onClick={(keyboard) => show({ kind: "meme" }, keyboard)}>Open the meme composer</ToolLink>
                        )}
                        {a.id === "community" && (
                          <ToolLink onClick={(keyboard) => show({ kind: "queue" }, keyboard)}>Open the community queue</ToolLink>
                        )}
                      </div>
                    </header>
                    <ul>
                      {rows.map((c) => (
                        <Row key={c.id} c={c} onOpen={(c, keyboard) => show({ kind: "channel", c }, keyboard)} picked={picked.includes(c.id)} onPick={() => pick(c.id)} />
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>

        <div className="pointer-events-none sticky bottom-5 z-20 mt-12 flex justify-center">
          <AnimatePresence>
            {picked.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2, ease: EASE_UI }}
                className="pointer-events-auto flex h-14 w-full max-w-[560px] items-center gap-4 rounded-[10px] bg-ink pr-2 pl-4 text-canvas shadow-pop"
              >
                <span className={`${mono} shrink-0`}>
                  <span className="text-accent">{pad(picked.length)}</span> in kit
                </span>
                <span aria-hidden className="hidden min-w-0 items-center gap-2.5 overflow-hidden text-canvas/70 sm:flex">
                  {picked.slice(0, 7).map((id) => (
                    <ChannelLogo key={id} c={CHANNELS.find((c) => c.id === id)!} size={14} />
                  ))}
                </span>
                <button onClick={() => setPicked([])} className={`${mono} ml-auto text-canvas/60 transition-colors duration-150 hover:text-canvas`}>
                  Clear
                </button>
                <button onClick={(e) => generate(e.detail === 0)} className="press h-10 shrink-0 rounded-md bg-canvas px-4 text-[14px] font-medium text-ink">
                  {kit.status === "idle" ? "Generate posts" : "Open kit"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence custom={instant}>
        {open && (
          // One stable key: moving between sheets swaps content without replaying the slide.
          <Drawer key="sheet" title={panelTitle(open)} wide={open.kind === "meme"} instant={instant} onClose={close}>
            {open.kind === "meme" ? (
              <MemeSheet />
            ) : open.kind === "queue" ? (
              <QueueSheet key={open.focus} q={queue} focus={open.focus} back={open.back && (() => setOpen(open.back!))} />
            ) : open.kind === "kit" ? (
              <KitSheet
                picked={picked}
                kit={kit}
                onRemove={pick}
                pub={pub}
                onPublish={(id) => setOpen({ kind: "publish", id, back: open })}
                onQueue={(id, text) => setOpen({ kind: "queue", focus: queue.add(id, text), back: open })}
              />
            ) : open.kind === "channel" ? (
              <ChannelSheet
                c={open.c}
                picked={picked.includes(open.c.id)}
                onPick={() => pick(open.c.id)}
                actions={channelAction(open)}
              />
            ) : open.kind === "connections" ? (
              <ConnectionsSheet pub={pub} onPublish={(id) => setOpen({ kind: "publish", id, back: open })} back={open.back && (() => setOpen(open.back!))} />
            ) : (
              <PublishSheet
                key={open.id}
                id={open.id}
                pub={pub}
                draft={kit.drafts.find((d) => d.channelId === open.id)?.text}
                onDraft={(text) => kit.edit(open.id, text)}
                back={open.back && (() => setOpen(open.back!))}
                backLabel={backLabel(open.back)}
              />
            )}
          </Drawer>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
