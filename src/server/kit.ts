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
  if (ids.length > 10) throw new ApiError(400, "Choose up to 10 channels per kit.");
  const channels = ids.map(brief);
  if (channels.some((c) => !c)) throw new ApiError(400, "Unknown channel. Pick channels from the distribution catalog.");
  // Manual-only channels (Hacker News bans AI-written posts) get a prep checklist, never generated copy.
  const isManual = (id: string) => CHANNELS.find((c) => c.id === id)?.automation === "manual";
  const writing = channels.filter((c) => !isManual(c!.id));
  const kit = writing.length ? await deps.structured(kitResponse,
    "Write distribution drafts based on the project. Return exactly one post per requested channelId, following its guidance. Preserve product links from CTA layers. No markdown fences. Separate X thread posts with blank lines. Hashtags belong in the optional hashtags field. Drafts only; do not claim anything has been published.",
    { project: input.project, channels: writing }, signal) : { posts: [] };
  if (kit.posts.length !== writing.length || new Set(kit.posts.map((p) => p.channelId)).size !== writing.length || kit.posts.some((p) => !ids.includes(p.channelId) || isManual(p.channelId) || !p.text.trim())) {
    throw new ApiError(502, "The copy agent returned incomplete drafts. Please try again.");
  }
  for (const id of ids.filter(isManual)) {
    kit.posts.push({ channelId: id, text: "Prep checklist: confirm your product URL works without signup, read the current submission rules, then write your own title and replies and submit it yourself." });
  }
  return kit;
}
