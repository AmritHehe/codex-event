import { z } from "zod";
import { kitRequest, kitResponse } from "@/lib/contracts";
import { KIT_CHANNELS } from "@/lib/kit-channels";
import { CHANNELS } from "@/distribution/channels";
import { ApiError } from "./http";
import { providers, type Providers } from "./providers";

export async function generateKit(input: z.infer<typeof kitRequest>, signal: AbortSignal, deps: Providers = providers) {
  const ids = [...new Set(input.channels)];
  if (ids.length > 10) throw new ApiError(400, "Choose up to 10 channels per kit generation.");
  const channels = ids.map((id) => {
    const curated = KIT_CHANNELS.find((c) => c.id === id);
    const catalog = CHANNELS.find((c) => c.id === id);
    return curated ?? (catalog ? { id, label: catalog.name, guidance: `Prepare a draft only. Channel context: ${catalog.what} Advice: ${catalog.tip} Keep it under 200 words.` } : undefined);
  });
  if (channels.some((c) => !c)) throw new ApiError(400, "Choose channels from the distribution catalog.");
  const writing = channels.filter((c) => c?.id !== "hacker-news");
  const kit = writing.length ? await deps.structured(kitResponse,
    "Write distribution drafts based on the project. Return exactly one post per requested channelId, following its guidance. Preserve product links from CTA layers. No markdown fences. Separate X thread posts with blank lines. Hashtags belong in the optional hashtags field. Drafts only; do not claim anything has been published.",
    { project: input.project, channels: writing }, signal) : { posts: [] };
  if (ids.includes("hacker-news")) kit.posts.push({ channelId: "hacker-news", text: "HN preparation checklist: verify your product URL, read the current submission rules, and write your own title and comments. Submit manually." });
  if (kit.posts.length !== channels.length || new Set(kit.posts.map((p) => p.channelId)).size !== channels.length || kit.posts.some((p) => !input.channels.includes(p.channelId) || !p.text.trim())) {
    throw new ApiError(502, "The copy agent returned incomplete drafts. Please try again.");
  }
  return kit;
}
