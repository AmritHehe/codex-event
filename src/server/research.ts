import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { researchBrief, type ResearchBrief } from "@/lib/research-contracts";
import { requireGateway } from "./ai";
import { ApiError } from "./http";
import { providers, type Providers } from "./providers";
import { publicUrl } from "./scrape";

const DAY_MS = 86_400_000;
const EXA_TIMEOUT_MS = 25_000;
const MAIN_TEXT = 8_000;
const SUBPAGE_TEXT = 3_000;

const exaPage = z.object({
  url: z.string(),
  title: z.string().nullish(),
  text: z.string().nullish(),
  image: z.string().nullish(),
  favicon: z.string().nullish(),
  publishedDate: z.string().nullish(),
  highlights: z.array(z.string()).nullish(),
  extras: z.object({ imageLinks: z.array(z.string()).nullish() }).nullish(),
});
const exaResults = z.object({ results: z.array(exaPage.extend({ subpages: z.array(exaPage).nullish() })) });
type ExaPage = z.infer<typeof exaPage>;

/** Exa returns arbitrary web URLs: keep only public http(s) ones, the same rule we apply to user input. */
const safe = (value: string | null | undefined) => {
  if (!value) return undefined;
  try { return publicUrl(value); } catch { return undefined; }
};
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const onSite = (url: string, host: string) => { const h = hostOf(url); return h === host || h.endsWith(`.${host}`); };
// Grounding checks compare loosely: case, quotes, markdown punctuation and whitespace don't matter.
const norm = (s: string) => s.toLowerCase().replace(/[“”"'‘’*_#>`|]/g, "").replace(/\s+/g, " ").trim();
const numbers = (s: string) => s.match(/\d[\d,.]*/g)?.map((n) => n.replace(/[,.]$/, "").replace(/,/g, "")) ?? [];
const plain = (s: string) => s.replace(/[#*_>`[\]()|]/g, " ").replace(/\s+/g, " ").trim();

// ---------- cache: one file per normalized URL (no www, query or trailing slash), 24h ----------
const cacheDir = () => resolve(/*turbopackIgnore: true*/ process.env.RESEARCH_DATA_DIR ?? ".data/research");
const cacheFile = (url: string) => {
  const u = new URL(publicUrl(url));
  const key = `${hostOf(u.href)}${u.pathname.replace(/\/+$/, "")}`;
  return join(cacheDir(), `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);
};

/** The cached brief for this URL if researched in the last 24 hours, else null. Never calls a provider. */
export async function cachedResearch(url: string): Promise<ResearchBrief | null> {
  try {
    const brief = researchBrief.parse(JSON.parse(await readFile(cacheFile(url), "utf8")));
    return Date.now() - Date.parse(brief.researchedAt) < DAY_MS ? brief : null;
  } catch {
    return null;
  }
}

async function saveResearch(brief: ResearchBrief) {
  const file = cacheFile(brief.url);
  await mkdir(cacheDir(), { recursive: true });
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(brief));
  await rename(temporary, file);
}

// ---------- the model only writes what needs judgment; mention text, visuals and sources are copied from Exa ----------
const draftSchema = z.object({
  product: researchBrief.shape.product,
  features: z.array(researchBrief.shape.features.element),
  proof: z.array(researchBrief.shape.proof.element),
  mentionUrls: z.array(z.string()).describe("Candidate urls that are about this exact product."),
  competitors: z.array(researchBrief.shape.competitors.element),
  voice: z.object({ adjectives: z.array(z.string()), sampleLines: z.array(researchBrief.shape.voice.shape.sampleLines.element) }),
});

const SYSTEM = `You are a product researcher preparing a brief for a launch film and launch copy.
Input: "pages" are the product's own site. "candidates" are third-party pages from web search: some are about this product, some are other products, some are unrelated or about a different company that shares the name.
Use only facts stated in these sources. Each sourceUrl must be copied exactly from the url of the source that states the fact.
- product: the name as the site writes it, a plain one-liner (at most 20 words), category, audience, and the problem it removes.
- features: 3 to 6 concrete capabilities, each with the customer benefit in a short sentence.
- mentionUrls: urls of candidates clearly about THIS product (same name AND the same kind of product that "pages" describe): reviews, launch posts, directory listings, discussions. Leave out pages about a different company with the same name.
- proof: only metrics, customer quotes, awards or named customers stated by "pages" or by a candidate in mentionUrls. Copy numbers and quotes exactly. If there are none, return an empty list; that is the correct answer.
- competitors: up to 5 candidates that are a different product's own site solving a similar problem for a similar audience (never directories, listicles, blogs or listings of this product). url copied from candidates. howDifferent compares them using only their text and this product's pages.
- voice: 3 to 5 adjectives for how the product's site writes, and up to 5 short sampleLines copied word for word from "pages".
Keep every string under 300 characters.`;

const HIGHLIGHTS = { query: "What this product does and who it is for", maxCharacters: 400 };

/**
 * Sourced product research. Concurrently: Exa contents (site + subpages), Exa search (third-party mentions) and Exa
 * findSimilar; a competitor search (category "company") starts as soon as the site text describes the product.
 * One cheap structured() call then sorts the third-party pages and writes the brief. Cached per URL for 24h.
 */
export async function research(value: string, signal: AbortSignal, deps: Providers = providers): Promise<ResearchBrief> {
  const url = publicUrl(value);
  const cached = await cachedResearch(url);
  if (cached) return cached;
  if (deps === providers) requireGateway(); // fail before spending Exa credits
  const host = hostOf(url);
  const brand = host.split(".")[0];
  const call = async (path: "/contents" | "/search" | "/findSimilar", body: object) =>
    exaResults.parse(await deps.exa(path, body, AbortSignal.any([signal, AbortSignal.timeout(EXA_TIMEOUT_MS)]))).results;

  const contents = call("/contents", {
    urls: [url],
    text: { maxCharacters: MAIN_TEXT, verbosity: "compact" },
    subpages: 5,
    subpageTarget: ["pricing", "features", "about", "docs", "changelog", "blog"],
    extras: { imageLinks: 6 },
    livecrawlTimeout: 12_000,
  });
  const [site, searched, similar, alternatives] = await Promise.allSettled([
    contents,
    call("/search", {
      query: `Pages about ${host} (${brand}): reviews, launches, directory listings and discussions`,
      type: "auto",
      numResults: 10,
      excludeDomains: [host],
      startPublishedDate: new Date(Date.now() - 730 * DAY_MS).toISOString(),
      contents: { highlights: { query: `What people say about ${brand}`, maxCharacters: 500 } },
    }),
    // Exa marks /findSimilar deprecated but still serves it; it surfaces listings of the product and look-alike sites.
    call("/findSimilar", { url, numResults: 8, excludeSourceDomain: true, excludeDomains: [host], contents: { highlights: HIGHLIGHTS } }),
    // Exa's documented replacement for findSimilar: a search that describes the product in its own words.
    contents.then(([main]) => call("/search", {
      query: `Alternatives to ${plain(`${main?.title ?? brand}: ${main?.text ?? ""}`).slice(0, 240)}`,
      type: "auto",
      category: "company",
      numResults: 8,
      excludeDomains: [host],
      contents: { highlights: HIGHLIGHTS },
    })),
  ]);
  if (signal.aborted) throw signal.reason;
  if (site.status === "rejected") {
    throw site.reason instanceof ApiError ? site.reason : new ApiError(502, "Could not research this product page. Try another public URL.");
  }

  // Own pages: the product URL plus subpages, deduped, public, with text.
  const own: (ExaPage & { url: string })[] = [];
  const main = site.value[0];
  for (const page of main ? [main, ...(main.subpages ?? [])] : []) {
    const pageUrl = safe(page.url);
    if (!pageUrl || !page.text?.trim() || own.some((p) => p.url === pageUrl)) continue;
    own.push({ ...page, url: pageUrl, text: page.text.slice(0, own.length ? SUBPAGE_TEXT : MAIN_TEXT) });
    if (own.length === 6) break;
  }
  if (!own.length) throw new ApiError(502, "Could not read this product page. Try another public URL.");

  // Third-party candidates from every search: public, never the product's own domain, deduped.
  const candidates = [searched, similar, alternatives]
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .flatMap((r) => { const u = safe(r.url); return u && !onSite(u, host) ? [{ ...r, url: u, highlight: (r.highlights ?? []).join(" … ").slice(0, 600) }] : []; })
    .filter((r, i, all) => all.findIndex((x) => x.url === r.url) === i)
    .slice(0, 24);

  const draft = await deps.structured(draftSchema, SYSTEM, {
    product: { url, host },
    pages: own.map((p) => ({ url: p.url, title: p.title ?? "", text: p.text })),
    candidates: candidates.map((c) => ({ url: c.url, title: c.title ?? "", highlight: c.highlight, ...(c.publishedDate ? { publishedDate: c.publishedDate } : {}) })),
  }, signal);

  const mentioned = new Set(draft.mentionUrls.map(safe));
  const mentions = candidates
    .filter((c) => mentioned.has(c.url))
    .sort((a, b) => (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""))
    .slice(0, 8)
    .map((c) => ({
      title: (c.title || hostOf(c.url)).slice(0, 200),
      url: c.url,
      source: hostOf(c.url).slice(0, 100),
      highlight: c.highlight,
      ...(c.publishedDate ? { publishedDate: c.publishedDate } : {}),
    }));
  // A competitor is another product's site among the candidates, never a page about this product.
  const competitors = draft.competitors.flatMap((c) => {
    const match = safe(c.url) && candidates.find((r) => !mentioned.has(r.url) && hostOf(r.url) === hostOf(c.url));
    return match ? [{ ...c, url: match.url }] : [];
  }).filter((c, i, all) => all.findIndex((x) => hostOf(x.url) === hostOf(c.url)) === i).slice(0, 5);

  // Ground the model's output: every claim must cite a page we fetched, and quoted text must be in it.
  const sourceText = new Map<string, string>([
    ...own.map((p) => [p.url, norm(`${p.title ?? ""} ${p.text}`)] as const),
    ...mentions.map((m) => [m.url, norm(`${m.title} ${m.highlight}`)] as const),
  ]);
  const cites = (sourceUrl: string) => sourceText.has(sourceUrl);
  const stated = (text: string, sourceUrl: string) => {
    const body = sourceText.get(sourceUrl)?.replace(/,/g, "");
    return !!body && numbers(text).every((n) => body.includes(n));
  };
  const ownText = (sourceUrl: string) => own.find((p) => p.url === sourceUrl) && sourceText.get(sourceUrl);
  // ponytail: quotes are checked on their first 40 normalized characters, enough to catch invented quotes.
  const quoted = (text: string, sourceUrl: string) => !!sourceText.get(sourceUrl)?.includes(norm(text).slice(0, 40));

  const visuals = [
    ...own.map((p) => ({ url: safe(p.image), kind: "og" as const })),
    { url: safe(main?.favicon), kind: "logo" as const },
    ...(main?.extras?.imageLinks ?? []).filter((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(u)).map((u) => ({ url: safe(u), kind: "screenshot" as const })),
  ].filter((v, i, all): v is { url: string; kind: typeof v.kind } => !!v.url && all.findIndex((x) => x.url === v.url) === i).slice(0, 8);

  const brief = researchBrief.parse({
    url,
    researchedAt: new Date().toISOString(),
    product: { ...draft.product, sourceUrl: cites(draft.product.sourceUrl) ? draft.product.sourceUrl : own[0].url },
    features: draft.features.filter((f) => cites(f.sourceUrl)).slice(0, 8),
    proof: draft.proof.filter((p) => cites(p.sourceUrl) && stated(p.text, p.sourceUrl) && (p.kind !== "quote" || quoted(p.text, p.sourceUrl))).slice(0, 6),
    competitors,
    mentions,
    voice: {
      adjectives: draft.voice.adjectives.map((a) => a.slice(0, 30)).slice(0, 5),
      sampleLines: draft.voice.sampleLines.filter((l) => !!ownText(l.sourceUrl)?.includes(norm(l.text))).slice(0, 5),
    },
    visuals,
    sources: [
      ...own.map((p) => ({ url: p.url, title: (p.title || hostOf(p.url)).slice(0, 200) })),
      ...mentions.map((m) => ({ url: m.url, title: m.title })),
      ...competitors.map((c) => ({ url: c.url, title: c.name.slice(0, 200) })),
    ].filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i).slice(0, 30),
  });
  await saveResearch(brief).catch(() => {}); // a read-only disk must not fail paid research
  return brief;
}
