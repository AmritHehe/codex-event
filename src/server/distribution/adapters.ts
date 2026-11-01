import { z } from "zod";
import { PUBLISH_CHANNELS, type PublishInput, type PublishReceipt } from "@/lib/distribution-contracts";
import { DistributionError } from "./http";

const required: Record<PublishInput["channel"], string[]> = {
  x: ["X_USER_ACCESS_TOKEN"], bluesky: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"],
  threads: ["THREADS_USER_ID", "THREADS_ACCESS_TOKEN"], mastodon: ["MASTODON_BASE_URL", "MASTODON_ACCESS_TOKEN"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"], tiktok: ["AYRSHARE_API_KEY"],
  "youtube-shorts": ["AYRSHARE_API_KEY"], pinterest: ["AYRSHARE_API_KEY"], "linkedin-page": ["AYRSHARE_API_KEY"],
};
export const connections = () => PUBLISH_CHANNELS.map((c) => ({ ...c, configured: required[c.id].every((key) => !!process.env[key]) }));
export function requireConnection(channel: PublishInput["channel"]) {
  if (!required[channel].every((key) => !!process.env[key])) throw new DistributionError(503, "This channel is not connected. Configure its server credentials first.");
}

type Fetcher = typeof fetch;
export async function publish(input: PublishInput, signal: AbortSignal, fetcher: Fetcher = fetch): Promise<PublishReceipt> {
  requireConnection(input.channel);
  const env = (key: string) => process.env[key]!;
  const post = async (url: string, body: unknown, headers: Record<string, string> = {}) => {
    const response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal, redirect: "error" });
    if (!response.ok) throw new DistributionError(502, "The channel rejected the request. Check account permissions and post limits before retrying.");
    return await response.json() as unknown;
  };
  const receipt: PublishReceipt = { requestId: input.requestId, channel: input.channel, providerId: "", status: "published" };
  if (input.channel === "x") {
    const data = z.object({ data: z.object({ id: z.string() }) }).parse(await post("https://api.x.com/2/tweets", { text: input.text }, { Authorization: `Bearer ${env("X_USER_ACCESS_TOKEN")}` }));
    return { ...receipt, providerId: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` };
  }
  if (input.channel === "bluesky") {
    const session = z.object({ did: z.string(), accessJwt: z.string() }).parse(await post("https://bsky.social/xrpc/com.atproto.server.createSession", { identifier: env("BLUESKY_IDENTIFIER"), password: env("BLUESKY_APP_PASSWORD") }));
    const data = z.object({ uri: z.string() }).parse(await post("https://bsky.social/xrpc/com.atproto.repo.createRecord", { repo: session.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text: input.text, createdAt: new Date().toISOString() } }, { Authorization: `Bearer ${session.accessJwt}` }));
    return { ...receipt, providerId: data.uri, url: `https://bsky.app/profile/${encodeURIComponent(session.did)}/post/${encodeURIComponent(data.uri.split("/").at(-1)!)}` };
  }
  if (input.channel === "threads") {
    const params = new URLSearchParams({ text: input.text, media_type: "TEXT", auto_publish_text: "true", access_token: env("THREADS_ACCESS_TOKEN") });
    const response = await fetcher(`https://graph.threads.net/v1.0/${encodeURIComponent(env("THREADS_USER_ID"))}/threads`, { method: "POST", body: params, signal, redirect: "error" });
    if (!response.ok) throw new DistributionError(502, "Threads rejected the post. Check the account permissions.");
    return { ...receipt, providerId: z.object({ id: z.string() }).parse(await response.json()).id };
  }
  if (input.channel === "mastodon") {
    const base = new URL(env("MASTODON_BASE_URL"));
    if (base.protocol !== "https:" || base.username || base.password) throw new DistributionError(503, "Configure an HTTPS Mastodon instance URL.");
    const data = z.object({ id: z.string(), url: z.string().url() }).parse(await post(new URL("/api/v1/statuses", base).href, { status: input.text, visibility: "public" }, { Authorization: `Bearer ${env("MASTODON_ACCESS_TOKEN")}`, "Idempotency-Key": input.requestId }));
    return { ...receipt, providerId: data.id, url: data.url };
  }
  if (input.channel === "telegram") {
    const data = z.object({ ok: z.literal(true), result: z.object({ message_id: z.number() }) }).parse(await post(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, { chat_id: env("TELEGRAM_CHAT_ID"), text: input.text }));
    return { ...receipt, providerId: String(data.result.message_id) };
  }
  const platform = { tiktok: "tiktok", "youtube-shorts": "youtube", pinterest: "pinterest", "linkedin-page": "linkedin" }[input.channel];
  const body = {
    post: input.text, platforms: [platform], idempotencyKey: input.requestId,
    ...(input.mediaUrl && { mediaUrls: [input.mediaUrl] }), ...(input.scheduleAt && { scheduleDate: input.scheduleAt }),
    ...(input.channel === "youtube-shorts" && { youTubeOptions: { title: input.title, shorts: true, visibility: input.visibility } }),
    ...(input.channel === "pinterest" && { pinterestOptions: { boardId: input.boardId, title: input.title } }),
  };
  const result = z.object({ status: z.literal("success"), id: z.string(), errors: z.array(z.unknown()).optional(), postIds: z.array(z.object({ status: z.string(), postUrl: z.string().optional() })).optional() }).parse(await post("https://api.ayrshare.com/api/post", body, { Authorization: `Bearer ${env("AYRSHARE_API_KEY")}`, ...(process.env.AYRSHARE_PROFILE_KEY && { "Profile-Key": env("AYRSHARE_PROFILE_KEY") }) }));
  if (result.errors?.length || result.postIds?.some((p) => p.status === "error")) throw new DistributionError(502, "The aggregator reported a channel error. Check its dashboard before retrying.");
  return { ...receipt, providerId: result.id, status: input.scheduleAt ? "scheduled" : "submitted", scheduleAt: input.scheduleAt, url: result.postIds?.[0]?.postUrl };
}
