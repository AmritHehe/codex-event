import type { Metadata } from "next";
import { AGENTS } from "@/distribution/agents";
import { CHANNELS } from "@/distribution/channels";
import { Agents } from "@/landing/Agents";
import { Finale } from "@/landing/Finale";
import { Hero } from "@/landing/Hero";
import { Hud } from "@/landing/Hud";
import { Reflow } from "@/landing/Reflow";
import { Sorter } from "@/landing/Sorter";

export const metadata: Metadata = {
  title: "Shipcast · Launch videos and distribution for your product",
  description: `Turn your product into launch videos, threads and memes, then get them in front of people on ${CHANNELS.length} channels.`,
};

// The page is a timeline: every [data-scene] section is a scene, the Hud is its playhead.
export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas pb-5 md:pb-7">
      <Hud />
      <main>
        <Hero channels={CHANNELS.length} agents={AGENTS.length} />
        <Reflow />
        <Sorter />
        <Agents />
        <Finale channels={CHANNELS.length} />
      </main>
    </div>
  );
}
