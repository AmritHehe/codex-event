import { z } from "zod";
import { projectSchema } from "@/video/schema";
import { requireGateway } from "./ai";
import { validateProject } from "./project";
import { providers, type Providers } from "./providers";
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

export async function generate(url: string, signal: AbortSignal, deps: Providers = providers) {
  const productUrl = publicUrl(url);
  if (deps === providers) requireGateway(); // fail before spending scraping credits
  const page = await deps.scrapeProduct(productUrl, signal);
  const project = await deps.structured(projectSchema,
    "Create an editable launch video with five scenes: hook, problem, product, features, CTA. Use short readable headlines, 90 to 180 frames per scene at 30fps, unique IDs across all scenes and layers, 16:9 aspect, a coherent theme based on the brand colors, and only the supplied screenshot for image layers. Include a CTA linking to the product URL. Use only facts from the source page.",
    page, signal);
  return { project: withScreenshot(project, page), brand: page.brand };
}

