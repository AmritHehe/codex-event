import type { Metadata } from "next";
import Link from "next/link";
import { AGENTS } from "@/distribution/agents";
import { CHANNELS } from "@/distribution/channels";
import { FanOut } from "@/landing/FanOut";
import { Hero } from "@/landing/Hero";
import { Loud } from "@/landing/Loud";
import { Reflow } from "@/landing/Reflow";
import { Sorter } from "@/landing/Sorter";

export const metadata: Metadata = {
  title: "Shipcast · Launch videos and distribution for your product",
  description: "Turn your product into launch videos, threads and memes, then get them in front of people on 66 channels.",
};

function Mark() {
  return <span className="grid size-7 place-items-center rounded-full bg-ink font-display text-[13px] font-bold text-white">S</span>;
}

export default function Landing() {
  return (
    <div className="grain min-h-dvh overflow-x-clip bg-canvas">
      <nav className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="flex h-12 items-center gap-1 rounded-full bg-white/70 py-1.5 pr-1.5 pl-3 shadow-[0_8px_24px_-12px_rgb(24_24_27/0.25),0_0_0_1px_rgb(24_24_27/0.06)] backdrop-blur-xl">
          <Link href="/" className="mr-3 flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
            <Mark />
            Shipcast
          </Link>
          <Link href="/distribution" className="rounded-full px-3 py-1.5 text-[14px] text-muted hover:text-ink max-sm:hidden">
            Channels
          </Link>
          <Link href="/studio" className="press ml-1 inline-flex h-9 items-center rounded-full bg-ink px-4 text-[14px] font-medium text-white">
            Open Studio
          </Link>
        </div>
      </nav>

      <Hero channels={CHANNELS.length} />
      <Reflow />
      <FanOut total={CHANNELS.length} agents={AGENTS.length} />
      <Sorter />
      <Loud />

      <footer className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-6 px-4 py-10 text-[14px] text-muted md:px-8">
        <span className="flex items-center gap-2 font-display font-bold text-ink">
          <Mark />
          Shipcast
        </span>
        <Link href="/studio" className="hover:text-ink">
          Studio
        </Link>
        <Link href="/distribution" className="hover:text-ink">
          Channels
        </Link>
        <span className="ml-auto">© 2026 Shipcast</span>
      </footer>
    </div>
  );
}
