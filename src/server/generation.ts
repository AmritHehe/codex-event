import { z } from "zod";
import { archiveScreenshot } from "./assets/blob";
import { projectSchema } from "@/video/schema";
import { requireGateway } from "./ai";
import { validateProject } from "./project";
import { providers, type Providers } from "./providers";
import { research } from "./research";
import { publicUrl, type ProductPage } from "./scrape";

export function withScreenshot(project: z.infer<typeof projectSchema>, page: ProductPage) {
  // Media must come from the scrape rather than hallucinated or private URLs.
  let hasScreenshot = false;
  const scenes = project.scenes.map((s) => ({ ...s, layers: s.layers.map((layer) => {
    if (layer.type !== "image") return layer;
    hasScreenshot = true;
    return { ...layer, src: page.brand.screenshot };
  }) }));
  if (!hasScreenshot) scenes[Math.min(2, scenes.length - 1)].layers.push({
    id: crypto.randomUUID(), type: "image", src: page.brand.screenshot, frame: "browser", size: "lg",
  });
  return validateProject({ ...project, scenes });
}

/** A stat is a claim: keep it only when its number appears in the sources. Scenes left empty are dropped. */
export function withSourcedStats(project: z.infer<typeof projectSchema>, sources: string) {
  const text = sources.replace(/,/g, "");
  const sourced = (value: number) => new RegExp(`(^|[^\\d.])${String(value).replace(".", "\\.")}(?!\\d)`).test(text);
  const scenes = project.scenes
    .map((s) => ({ ...s, layers: s.layers.filter((l) => l.type !== "stat" || sourced(l.value)) }))
    .filter((s) => s.layers.length);
  return { ...project, scenes: scenes.length ? scenes : project.scenes };
}

// Art direction comes first in the output so the model commits to an angle before writing scenes.
export const filmSchema = z.object({
  direction: z.object({
    angle: z.string().describe("The one story this film tells, in a sentence."),
    hook: z.string().describe("The opening line: the sharpest pain or payoff, at most 7 words."),
    proofPoints: z.array(z.string()).max(3).describe("The 3 strongest sourced facts (proof, features or mentions), quoted from the research."),
    visualConcept: z.string().describe("Mood, palette and motion idea drawn from the brand and voice."),
  }),
  project: projectSchema,
});

const FILM_PROMPT = `You are the creative director of a 12 to 20 second product launch film. First write "direction", then "project".
Direction: read the research brief (or the page text when there is no brief) and pick ONE story angle for this product's audience, a hook, the 3 strongest proof points, and a visual concept that fits the brand colors and voice.
Project: 16:9, 30fps, unique ids across all scenes and layers, theme built from the brand colors (accent readable on background), headingFont with character and a neutral bodyFont.
Scenes, in order:
1. hook (60-75 frames): badge + the hook as headline.
2. problem (60-90): kicker + headline naming the problem in the customer's words.
3. product (90-120, layout "split"): kicker with the product name, headline with the core promise, short body, and one image layer (frame "browser", kenBurns true).
4. features (90-110): headline + list layer with 3 to 4 sourced features, each under 6 words.
5. proof (60-75, ONLY if the brief has proof or mentions): a stat layer only for a number stated in proof, otherwise a short quote or "As seen on <source>" built from a mention.
6. cta (75-90): headline + cta layer whose url is the product URL.
Headlines at most 7 words with exactly one *highlighted* word; body at most 12 words. Write in the product's voice; reuse its sampleLines where they fit. Vary transitions (first scene "none") and alternate backgrounds.
Every fact must come from the research brief or the page text. Never invent numbers, quotes, customers or prices; drop the proof scene if nothing is sourced.`;

export async function generate(url: string, signal: AbortSignal, deps: Providers = providers, workspaceId = "anonymous") {
  const productUrl = publicUrl(url);
  if (deps === providers) requireGateway(); // fail before spending scraping credits
  // Research is best effort: without Exa (or when it fails) the film is written from the scraped page alone.
  const [page, brief] = await Promise.all([
    deps.scrapeProduct(productUrl, signal),
    research(productUrl, signal, deps).catch(() => null),
  ]);
  // Archive to Blob when possible; an untrusted image host keeps its original URL instead of failing the film.
  if (deps === providers && process.env.BLOB_READ_WRITE_TOKEN) page.brand.screenshot = await archiveScreenshot(workspaceId, page.brand.screenshot, signal).catch(() => page.brand.screenshot);
  const { project } = await deps.structured(filmSchema, FILM_PROMPT, {
    url: productUrl,
    brand: { name: page.brand.name, tagline: page.brand.tagline, colors: page.brand.colors },
    research: brief,
    pageText: brief ? page.markdown.slice(0, 4_000) : page.markdown,
  }, signal, "high");
  const sourced = withSourcedStats(project, `${page.markdown}\n${brief ? JSON.stringify([brief.proof, brief.mentions]) : ""}`);
  return { project: withScreenshot(sourced, page), brand: page.brand, ...(brief ? { research: brief } : {}) };
}
