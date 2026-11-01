import { z } from "zod";
import { kitRequest, kitResponse } from "@/lib/contracts";
import { KIT_CHANNELS } from "@/lib/kit-channels";
import { ApiError } from "./http";
import { providers, type Providers } from "./providers";

export async function generateKit(input: z.infer<typeof kitRequest>, signal: AbortSignal, deps: Providers = providers) {
  const channels = [...new Set(input.channels)].map((id) => KIT_CHANNELS.find((c) => c.id === id));
  if (channels.some((c) => !c)) throw new ApiError(400, "Choose supported kit channels: X, LinkedIn, Product Hunt, Reels, or TikTok.");
  const kit = await deps.structured(kitResponse,
    "Write distribution drafts based on the project. Return exactly one post per requested channelId, following its guidance. Preserve product links from CTA layers. No markdown fences. Separate X thread posts with blank lines. Hashtags belong in the optional hashtags field. Drafts only; do not claim anything has been published.",
    { project: input.project, channels }, signal);
  if (kit.posts.length !== channels.length || new Set(kit.posts.map((p) => p.channelId)).size !== channels.length || kit.posts.some((p) => !input.channels.includes(p.channelId) || !p.text.trim())) {
    throw new ApiError(502, "The copy agent returned incomplete drafts. Please try again.");
  }
  return kit;
}
