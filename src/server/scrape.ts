import { isIP } from "node:net";
import { z } from "zod";
import { ApiError } from "./http";

/** Firecrawl fetches remotely; never forward local addresses or credentials to it. */
export function publicUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const privateV4 = isIP(host) === 4 && /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(18|19)\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/.test(host);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !host.includes(".") || isIP(host) === 6 || privateV4 || /\.(localhost|local|internal|test|invalid)$/.test(host)) {
    throw new ApiError(400, "Use a public http or https product URL without credentials.");
  }
  return url.href;
}

function assetUrl(value: string | undefined, base: string) {
  if (!value) return undefined;
  try { return publicUrl(new URL(value, base).href); } catch { return undefined; }
}

const scrapeResult = z.object({
  success: z.literal(true),
  data: z.object({
    markdown: z.string().min(1),
    screenshot: z.string().optional(),
    metadata: z.object({ title: z.string().nullish(), description: z.string().nullish(), ogTitle: z.string().nullish(), ogSiteName: z.string().nullish() }).nullish(),
    branding: z.object({
      logo: z.string().nullish(),
      colors: z.record(z.string(), z.string().nullish()).optional(),
      images: z.object({ logo: z.string().nullish() }).optional(),
    }).nullish(),
  }),
});

export function parseScrape(raw: unknown, url: string) {
  const result = scrapeResult.safeParse(raw);
  if (!result.success) throw new ApiError(502, "Could not read this product page. Try another public URL.");
  const { data } = result.data;
  const screenshot = assetUrl(data.screenshot, url);
  if (!screenshot) throw new ApiError(502, "The product screenshot was unavailable. Please try again.");
  const colors = [...new Set(Object.values(data.branding?.colors ?? {}).filter((v): v is string => !!v && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)))];
  return {
    url,
    markdown: data.markdown.slice(0, 30_000),
    brand: {
      name: data.metadata?.ogSiteName || data.metadata?.ogTitle || data.metadata?.title || new URL(url).hostname,
      tagline: data.metadata?.description ?? undefined,
      colors,
      logo: assetUrl(data.branding?.logo ?? data.branding?.images?.logo ?? undefined, url),
      screenshot,
    },
  };
}

export type ProductPage = ReturnType<typeof parseScrape>;

const exaResult = z.object({
  results: z.array(z.object({ title: z.string().nullish(), text: z.string().nullish(), image: z.string().nullish(), favicon: z.string().nullish() })).min(1),
});

/** Fallback when Firecrawl isn't configured: Exa page contents, with the page's og:image standing in for a screenshot. */
async function scrapeWithExa(url: string, key: string, signal: AbortSignal): Promise<ProductPage> {
  const response = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ urls: [url], text: { maxCharacters: 30_000 } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(502, "Product scraping failed. Check Exa credits and try another URL.");
  const parsed = exaResult.safeParse(await response.json());
  if (!parsed.success || !parsed.data.results[0].text) throw new ApiError(502, "Could not read this product page. Try another public URL.");
  const page = parsed.data.results[0];
  const screenshot = assetUrl(page.image ?? undefined, url);
  if (!screenshot) throw new ApiError(502, "This page has no preview image to use as the product shot. Try the product's home page.");
  return {
    url,
    markdown: page.text!.slice(0, 30_000),
    brand: { name: page.title || new URL(url).hostname, tagline: undefined, colors: [], logo: assetUrl(page.favicon ?? undefined, url), screenshot },
  };
}

export async function scrapeProduct(value: string, signal: AbortSignal): Promise<ProductPage> {
  const url = publicUrl(value);
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key && process.env.EXA_API_KEY) return scrapeWithExa(url, process.env.EXA_API_KEY, signal);
  if (!key) throw new ApiError(503, "Product scraping is not configured. Set FIRECRAWL_API_KEY or EXA_API_KEY on the server.");
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "branding", { type: "screenshot", fullPage: false }], timeout: 45_000 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(502, "Product scraping failed. Check Firecrawl credits and try another URL.");
  return parseScrape(await response.json(), url);
}
