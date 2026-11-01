import {
  ArrowRightIcon,
  ArticleIcon,
  ButterflyIcon,
  ChatsCircleIcon,
  DiscordLogoIcon,
  GithubLogoIcon,
  HandshakeIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  MagnifyingGlassIcon,
  MastodonLogoIcon,
  OpenAiLogoIcon,
  PinterestLogoIcon,
  PlugsIcon,
  RedditLogoIcon,
  RobotIcon,
  RocketIcon,
  SlackLogoIcon,
  SmileyIcon,
  StorefrontIcon,
  TelegramLogoIcon,
  ThreadsLogoIcon,
  TiktokLogoIcon,
  TrophyIcon,
  VideoCameraIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { AGENTS, type AgentId } from "@/distribution/agents";
import { CHANNELS } from "@/distribution/channels";
import { AspectStrip, CtaThumb, HeroPlayer, Reveal, ThemeGrid } from "@/landing/client";

export const metadata: Metadata = {
  title: "Shipcast · Launch videos and distribution for your product",
  description: "Turn your product into launch videos, threads and memes, then get them in front of people on 66 channels.",
};

const AGENT_ICON: Record<AgentId, Icon> = {
  video: VideoCameraIcon,
  copy: ArticleIcon,
  meme: SmileyIcon,
  community: ChatsCircleIcon,
  launch: RocketIcon,
  listing: StorefrontIcon,
  search: MagnifyingGlassIcon,
  registry: RobotIcon,
  outreach: HandshakeIcon,
};

const MARQUEE: { icon: Icon; label: string }[] = [
  { icon: TiktokLogoIcon, label: "TikTok" },
  { icon: InstagramLogoIcon, label: "Instagram" },
  { icon: YoutubeLogoIcon, label: "YouTube" },
  { icon: XLogoIcon, label: "X" },
  { icon: LinkedinLogoIcon, label: "LinkedIn" },
  { icon: ThreadsLogoIcon, label: "Threads" },
  { icon: ButterflyIcon, label: "Bluesky" },
  { icon: RedditLogoIcon, label: "Reddit" },
  { icon: TrophyIcon, label: "Product Hunt" },
  { icon: DiscordLogoIcon, label: "Discord" },
  { icon: SlackLogoIcon, label: "Slack" },
  { icon: TelegramLogoIcon, label: "Telegram" },
  { icon: MastodonLogoIcon, label: "Mastodon" },
  { icon: PinterestLogoIcon, label: "Pinterest" },
  { icon: GithubLogoIcon, label: "GitHub" },
  { icon: OpenAiLogoIcon, label: "ChatGPT apps" },
  { icon: PlugsIcon, label: "MCP Registry" },
];

const count = (a: string) => CHANNELS.filter((c) => c.automation === a).length;
const SPLIT = [
  { label: "Auto-post", n: count("full"), cls: "bg-accent" },
  { label: "Agent drafts", n: count("assisted"), cls: "bg-ink" },
  { label: "Manual", n: count("manual"), cls: "bg-faint" },
];

const container = "mx-auto w-full max-w-[1200px] px-4 md:px-8";
const btn = "press inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[15px] font-medium whitespace-nowrap";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-[14px] text-white">S</span>
      Shipcast
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <nav className={`${container} flex h-16 items-center gap-6`}>
        <Logo />
        <div className="ml-auto flex items-center gap-1 text-[14px] text-muted max-sm:hidden">
          <Link href="/distribution" className="rounded-lg px-3 py-2 hover:text-ink">
            Distribution
          </Link>
          <a href="#how" className="rounded-lg px-3 py-2 hover:text-ink">
            How it works
          </a>
        </div>
        <Link href="/studio" className="press inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink/85 max-sm:ml-auto">
          Open Studio
        </Link>
      </nav>

      {/* Hero */}
      <header className={`${container} grid items-center gap-10 pt-10 pb-20 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:pt-16`}>
        <div className="flex flex-col gap-6">
          <Reveal>
            <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] md:text-[60px]">
              Building is solved.
              <br />
              <span className="text-accent">Distribution</span> isn&apos;t.
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted">
              Shipcast turns your product into launch videos, threads and memes, then gets them in front of people on {CHANNELS.length} channels.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="flex flex-wrap gap-3">
            <Link href="/studio" className={`${btn} bg-ink text-white hover:bg-ink/85`}>
              Open Studio
              <ArrowRightIcon size={16} weight="bold" />
            </Link>
            <Link href="/distribution" className={`${btn} bg-white text-ink shadow-panel hover:bg-hover`}>
              See the channels
            </Link>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <HeroPlayer />
        </Reveal>
      </header>

      {/* Video as code */}
      <section id="how" className={`${container} flex scroll-mt-8 flex-col gap-8 py-20`}>
        <Reveal className="flex max-w-[60ch] flex-col gap-3">
          <h2 className="text-[34px] leading-tight font-semibold tracking-[-0.03em] text-balance md:text-[42px]">One project. Every feed.</h2>
          <p className="text-[17px] leading-relaxed text-muted">Your launch video is built from layers, not pixels, so every word, color and format is one edit away.</p>
        </Reveal>
        <div className="grid gap-3 lg:grid-cols-3">
          <Reveal className="flex flex-col justify-between gap-8 rounded-2xl bg-white p-6 shadow-panel lg:col-span-2">
            <div className="flex max-w-[46ch] flex-col gap-1.5">
              <h3 className="text-[18px] font-semibold tracking-tight">Every format from one edit</h3>
              <p className="text-[15px] leading-relaxed text-muted">16:9 for X and YouTube, 9:16 for TikTok and Reels, 1:1 for LinkedIn. Layouts adapt on their own.</p>
            </div>
            <AspectStrip />
          </Reveal>
          <Reveal delay={0.06} className="flex flex-col gap-6 rounded-2xl bg-accent-soft p-6">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[18px] font-semibold tracking-tight">Restyle in one click</h3>
              <p className="text-[15px] leading-relaxed text-muted">Start from six themes or use your own brand colors and fonts.</p>
            </div>
            <ThemeGrid />
          </Reveal>
          <Reveal className="grid items-center gap-6 rounded-2xl bg-white p-6 shadow-panel md:grid-cols-2 lg:col-span-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[18px] font-semibold tracking-tight">Words, not keyframes</h3>
                <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted">
                  Type a headline, wrap a word in asterisks to highlight it, swap a screenshot. The video updates as you type.
                </p>
              </div>
              <code className="w-fit rounded-lg bg-canvas px-3 py-2 font-mono text-[14px]">
                Ship it. <span className="text-accent">*Loud.*</span>
              </code>
            </div>
            <CtaThumb />
          </Reveal>
        </div>
      </section>

      {/* Distribution */}
      <section className="flex flex-col gap-10 py-20">
        <Reveal className={`${container} flex flex-col gap-3`}>
          <h2 className="text-[34px] leading-tight font-semibold tracking-[-0.03em] md:text-[42px]">
            {CHANNELS.length} channels. {AGENTS.length === 9 ? "Nine" : AGENTS.length} agents.
          </h2>
          <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted">
            From TikTok and Product Hunt to the MCP Registry and ChatGPT&apos;s app directory, every place your launch can live has an agent that prepares it.
          </p>
        </Reveal>

        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]" aria-label="Supported channels">
          <ul className="marquee flex w-max gap-3">
            {[...MARQUEE, ...MARQUEE].map(({ icon: I, label }, i) => (
              <li key={i} aria-hidden={i >= MARQUEE.length} className="grid size-16 place-items-center rounded-2xl bg-white shadow-panel" title={label}>
                <I size={26} weight="fill" aria-label={label} />
              </li>
            ))}
          </ul>
        </div>

        <div className={`${container} grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3`}>
          {AGENTS.map((a, i) => {
            const I = AGENT_ICON[a.id];
            return (
              <Reveal key={a.id} delay={(i % 3) * 0.05} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <I size={18} weight="bold" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{a.name}</p>
                  <p className="text-[14px] leading-snug text-muted">{a.role}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <div className={container}>
          <Link href="/distribution" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
            See the channels
            <ArrowRightIcon size={15} weight="bold" />
          </Link>
        </div>
      </section>

      {/* Rules-aware automation */}
      <section className={`${container} py-20`}>
        <Reveal className="flex flex-col gap-8 rounded-3xl bg-white p-8 shadow-panel md:p-12">
          <div className="flex max-w-[62ch] flex-col gap-3">
            <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] md:text-[38px]">Posts itself where it&apos;s allowed. Drafts where it isn&apos;t.</h2>
            <p className="text-[17px] leading-relaxed text-muted">
              Some communities ban automated or AI-written posts. Shipcast follows each channel&apos;s rules: it publishes through official APIs where they exist and hands
              you a ready draft everywhere else.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex h-3 gap-1 overflow-hidden rounded-full" role="img" aria-label={SPLIT.map((s) => `${s.n} ${s.label}`).join(", ")}>
              {SPLIT.map((s) => (
                <span key={s.label} className={`${s.cls} rounded-full`} style={{ flexGrow: s.n }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
              {SPLIT.map((s) => (
                <span key={s.label} className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${s.cls}`} />
                  <span className="font-semibold tabular-nums">{s.n}</span>
                  <span className="text-muted">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Closing */}
      <section className={`${container} py-24`}>
        <Reveal className="flex flex-col items-start gap-6">
          <h2 className="text-[48px] leading-none font-semibold tracking-[-0.04em] md:text-[72px]">
            Ship it. <span className="text-accent">Loud.</span>
          </h2>
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted">Open the Studio and start from the sample launch video. Everything you change is saved in your browser.</p>
          <Link href="/studio" className={`${btn} bg-ink text-white hover:bg-ink/85`}>
            Open Studio
            <ArrowRightIcon size={16} weight="bold" />
          </Link>
        </Reveal>
      </section>

      <footer className={`${container} flex flex-wrap items-center gap-6 border-t border-line py-8 text-[14px] text-muted`}>
        <Logo />
        <Link href="/studio" className="hover:text-ink">
          Studio
        </Link>
        <Link href="/distribution" className="hover:text-ink">
          Distribution
        </Link>
        <span className="ml-auto">© 2026 Shipcast</span>
      </footer>
    </div>
  );
}
