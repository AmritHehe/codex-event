import { z } from "zod";

export const PUBLISH_CHANNELS = [
  { id: "x", name: "X", mode: "direct", limit: 280 },
  { id: "bluesky", name: "Bluesky", mode: "direct", limit: 300 },
  { id: "threads", name: "Threads", mode: "direct", limit: 500 },
  { id: "mastodon", name: "Mastodon", mode: "direct", limit: 500 },
  { id: "telegram", name: "Telegram", mode: "direct", limit: 4096 },
  { id: "tiktok", name: "TikTok", mode: "aggregator", limit: 2200 },
  { id: "youtube-shorts", name: "YouTube Shorts", mode: "aggregator", limit: 4500 },
  { id: "pinterest", name: "Pinterest", mode: "aggregator", limit: 500 },
  { id: "linkedin-page", name: "LinkedIn page", mode: "aggregator", limit: 3000 },
  { id: "instagram", name: "Instagram", mode: "aggregator", limit: 2200 },
] as const;
export const publishChannel = z.enum(["x", "bluesky", "threads", "mastodon", "telegram", "tiktok", "youtube-shorts", "pinterest", "linkedin-page", "instagram"]);
export const httpsUrl = z.string().url().refine((s) => { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password; }, "Use a public HTTPS URL without credentials.");
export const publishRequest = z.object({
  requestId: z.string().uuid(), channel: publishChannel, text: z.string().trim().min(1).max(5000),
  renderJobId: z.string().uuid().optional(), mediaUrl: httpsUrl.optional(), scheduleAt: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(100).optional(), boardId: z.string().regex(/^\d+$/).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("private"),
}).superRefine((data, ctx) => {
  const config = PUBLISH_CHANNELS.find((c) => c.id === data.channel)!;
  const length = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(data.text)].length;
  if (length > config.limit) ctx.addIssue({ code: "custom", message: `${config.name} text is limited to ${config.limit} characters.`, path: ["text"] });
  if (config.mode === "direct" && (data.mediaUrl || data.scheduleAt)) ctx.addIssue({ code: "custom", message: "Direct publishing supports immediate text posts. Use an aggregator channel for media or scheduling." });
  if (["tiktok", "youtube-shorts", "pinterest", "instagram"].includes(data.channel) && !data.mediaUrl && !data.renderJobId) ctx.addIssue({ code: "custom", message: "This channel requires a public media URL.", path: ["mediaUrl"] });
  if (data.channel === "youtube-shorts" && !data.title) ctx.addIssue({ code: "custom", message: "YouTube requires a title.", path: ["title"] });
  if (data.channel === "pinterest" && !data.boardId) ctx.addIssue({ code: "custom", message: "Pinterest requires a board ID.", path: ["boardId"] });
});
export const publishReceipt = z.object({ requestId: z.string().uuid(), channel: publishChannel, providerId: z.string(), status: z.enum(["published", "submitted", "scheduled"]), url: httpsUrl.optional(), scheduleAt: z.string().optional() });
export type PublishInput = z.infer<typeof publishRequest>;
export type PublishReceipt = z.infer<typeof publishReceipt>;
export const communityDraft = z.object({ id: z.string(), channel: z.enum(["reddit", "product-hunt", "hacker-news"]), text: z.string().max(20_000), status: z.enum(["draft", "ready", "done"]), projectName: z.string() });
export const memeTemplate = z.object({ id: z.string(), name: z.string(), url: httpsUrl, width: z.number().positive(), height: z.number().positive() });
export const templateResponse = z.object({ templates: z.array(memeTemplate) });
