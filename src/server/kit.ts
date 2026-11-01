import { z } from "zod";
import { CHANNELS } from "@/distribution/channels";
import { kitRequest, kitResponse } from "@/lib/contracts";
import { KIT_CHANNELS } from "@/lib/kit-channels";
import { ApiError } from "./http";
import { providers, type Providers } from "./providers";

/** Hand-written guidance where we have it; every other catalog channel is briefed from its research notes. */
function brief(id: string) {
  const known = KIT_CHANNELS.find((c) => c.id === id);
  if (known) return known;
  const c = CHANNELS.find((x) => x.id === id);
  if (!c) return undefined;
  return { id: c.id, label: c.name, guidance: `${c.what} Formats that work here: ${c.assets.join(", ")}. What works: ${c.tip} This is a draft a person will post.` };
}

export async function generateKit(input: z.infer<typeof kitRequest>, signal: AbortSignal, deps: Providers = providers) {
  const ids = [...new Set(input.channels)];
  const manual = ids.filter((id) => CHANNELS.find((c) => c.id === id)?.automation === "manual");
  if (manual.length) throw new ApiError(400, "Hacker News bans AI-written posts. Write that one yourself; the agent only preps and monitors it.");
  const channels = ids.map(brief);
  if (channels.some((c) => !c)) throw new ApiError(400, "Unknown channel. Pick channels from the distribution catalog.");
  const kit = await deps.structured(kitResponse,
    "Write distribution drafts based on the project. Return exactly one post per requested channelId, following its guidance. Preserve product links from CTA layers. No markdown fences. Separate X thread posts with blank lines. Hashtags belong in the optional hashtags field. Drafts only; do not claim anything has been published.",
    { project: input.project, channels }, signal);
  if (kit.posts.length !== channels.length || new Set(kit.posts.map((p) => p.channelId)).size !== channels.length || kit.posts.some((p) => !ids.includes(p.channelId) || !p.text.trim())) {
    throw new ApiError(502, "The copy agent returned incomplete drafts. Please try again.");
  }
  return kit;
}
