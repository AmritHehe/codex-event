import { z } from "zod";
import { memeTemplate } from "@/lib/distribution-contracts";
import { DistributionError } from "./http";

const responseSchema = z.object({ success: z.literal(true), data: z.object({ memes: z.array(memeTemplate) }) });
let cache: { expires: number; templates: z.infer<typeof memeTemplate>[] } | null = null;

export async function popularTemplates(signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (fetcher === fetch && cache && cache.expires > Date.now()) return cache.templates;
  const response = await fetcher("https://api.imgflip.com/get_memes", { signal, cache: "no-store", redirect: "error" });
  if (!response.ok) throw new DistributionError(502, "Meme templates are unavailable. Try again shortly.");
  const { data } = responseSchema.parse(await response.json());
  const templates = data.memes.filter((m) => new URL(m.url).hostname === "i.imgflip.com").slice(0, 30);
  if (fetcher === fetch) cache = { expires: Date.now() + 300_000, templates };
  return templates;
}

export async function templateImage(id: string, signal: AbortSignal) {
  const template = (await popularTemplates(signal)).find((m) => m.id === id);
  if (!template) throw new DistributionError(404, "Choose a template from the current popular list.");
  const response = await fetch(template.url, { signal, redirect: "error" });
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!response.ok || !type || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new DistributionError(502, "The template image could not be loaded.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000) throw new DistributionError(413, "This template image is too large.");
  return `data:${type};base64,${bytes.toString("base64")}`;
}
