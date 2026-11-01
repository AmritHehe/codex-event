"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AGENTS, type AgentId } from "./agents";
import { ASSET_LABEL, AUTOMATION, CATEGORIES, CHANNELS, type Automation, type CategoryId, type Channel } from "./channels";
import { AGENT_ICON, AgentGlyph, ChannelLogo, LOGO } from "./icons";


function AutomationBadge({ a }: { a: Automation }) {
  const cls = a === "full" ? "bg-accent-soft text-accent" : a === "assisted" ? "bg-hover text-ink" : "text-muted ring-1 ring-line ring-inset";
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium ${cls}`}>{AUTOMATION[a].label}</span>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`press h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium ${active ? "bg-ink text-white" : "bg-panel text-muted shadow-panel hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function ChannelDrawer({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const agent = AGENTS.find((a) => a.id === channel.agent)!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-30 bg-ink/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal
        aria-label={channel.name}
        className="fixed inset-y-2 right-2 z-40 flex w-[min(420px,calc(100vw-16px))] flex-col overflow-y-auto rounded-2xl bg-white shadow-pop"
        initial={{ transform: "translateX(104%)" }}
        animate={{ transform: "translateX(0%)" }}
        exit={{ transform: "translateX(104%)", transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-start gap-3 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas">
            <ChannelLogo c={channel} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-tight">{channel.name}</h2>
            <p className="text-[13px] text-muted">{CATEGORIES.find((c) => c.id === channel.category)?.label}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-ink">
            <XIcon size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-6 text-[14px] leading-relaxed">
          <p>{channel.what}</p>
          <div className="flex flex-wrap gap-1.5">
            <AutomationBadge a={channel.automation} />
            {channel.assets.map((a) => (
              <span key={a} className="inline-flex h-5 items-center rounded-md bg-canvas px-1.5 text-[11px] text-muted">
                {ASSET_LABEL[a] ?? a}
              </span>
            ))}
          </div>
          <section className="rounded-xl bg-canvas p-4">
            <h3 className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
              <AgentGlyph id={agent.id} />
              {agent.name}
            </h3>
            <p className="text-[13px] text-muted">{channel.agentDoes}</p>
          </section>
          <section>
            <h3 className="mb-1 text-[13px] font-semibold">How it connects</h3>
            <p className="text-[13px] text-muted">{channel.api}</p>
            <p className="mt-1 text-[12px] text-muted">{AUTOMATION[channel.automation].explain}</p>
          </section>
          <section>
            <h3 className="mb-1 text-[13px] font-semibold">What works</h3>
            <p className="text-[13px] text-muted">{channel.tip}</p>
          </section>
        </div>
      </motion.aside>
    </>
  );
}

export function Hub() {
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [automation, setAutomation] = useState<Automation | "all">("all");
  const [agent, setAgent] = useState<AgentId | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Channel | null>(null);

  const counts = useMemo(() => Object.fromEntries(AGENTS.map((a) => [a.id, CHANNELS.filter((c) => c.agent === a.id)])), []);
  const shown = CHANNELS.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (automation === "all" || c.automation === automation) &&
      (!agent || c.agent === agent) &&
      (!q || `${c.name} ${c.what}`.toLowerCase().includes(q.toLowerCase())),
  );
  const auto = CHANNELS.filter((c) => c.automation === "full").length;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Distribution</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
          {CHANNELS.length} channels, {AGENTS.length} agents. {auto} channels can be posted to automatically; the rest get drafts you approve.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Agents</h2>
          {agent && (
            <button onClick={() => setAgent(null)} className="text-[13px] text-muted hover:text-ink">
              Show all agents
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => {
            const I = AGENT_ICON[a.id];
            const active = agent === a.id;
            const covered = counts[a.id];
            const glyphs = covered.filter((c, i) => covered.findIndex((d) => (LOGO[d.id] ?? a.id) === (LOGO[c.id] ?? a.id)) === i);
            return (
              <button
                key={a.id}
                onClick={() => setAgent(active ? null : a.id)}
                aria-pressed={active}
                className={`press flex flex-col gap-3 rounded-xl p-4 text-left ${active ? "bg-white ring-2 ring-accent" : "bg-panel shadow-panel hover:bg-white"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-lg ${active ? "bg-accent text-white" : "bg-accent-soft text-accent"}`}>
                    <I size={18} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{a.name}</p>
                    <p className="truncate text-[13px] text-muted">{a.role}</p>
                  </div>
                </div>
                <ul className="flex flex-col gap-1 text-[12.5px] text-muted">
                  {a.does.map((d) => (
                    <li key={d} className="flex gap-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-faint" />
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-muted">
                  <div className="flex -space-x-1">
                    {glyphs.slice(0, 5).map((c) => (
                      <span key={c.id} className="grid size-5 place-items-center rounded-full bg-white ring-2 ring-panel">
                        <ChannelLogo c={c} size={11} />
                      </span>
                    ))}
                  </div>
                  {covered.length} channels
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold">Channels</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2 lg:ml-auto">
            <select
              aria-label="Automation"
              value={automation}
              onChange={(e) => setAutomation(e.target.value as Automation | "all")}
              className="h-8 rounded-lg bg-panel px-2.5 text-[13px] shadow-panel outline-none"
            >
              <option value="all">Any automation</option>
              {(Object.keys(AUTOMATION) as Automation[]).map((a) => (
                <option key={a} value={a}>
                  {AUTOMATION[a].label}
                </option>
              ))}
            </select>
            <label className="relative">
              <span className="sr-only">Search channels</span>
              <MagnifyingGlassIcon size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-8 w-44 rounded-lg bg-panel pr-2.5 pl-8 text-[13px] shadow-panel outline-none placeholder:text-muted"
              />
            </label>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl bg-panel p-10 text-center shadow-panel">
            <p className="text-[14px] font-medium">No channels match these filters.</p>
            <button
              onClick={() => {
                setCategory("all");
                setAutomation("all");
                setAgent(null);
                setQ("");
              }}
              className="mt-2 text-[13px] text-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => {
              return (
                <button key={c.id} onClick={() => setOpen(c)} className="press flex gap-3 rounded-xl bg-panel p-4 text-left shadow-panel hover:bg-white">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas">
                    <ChannelLogo c={c} size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{c.name}</span>
                      <AutomationBadge a={c.automation} />
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-snug text-muted">{c.what}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>{open && <ChannelDrawer key={open.id} channel={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}
