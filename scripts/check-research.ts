import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { POST as researchPost } from "../src/app/api/research/route";
import { POST as generatePost } from "../src/app/api/generate/route";
import { generateResponse } from "../src/lib/contracts";
import { researchBrief, type ResearchBrief } from "../src/lib/research-contracts";
import { generateKit } from "../src/server/kit";
import { ApiError } from "../src/server/http";
import { providers, type Providers } from "../src/server/providers";
import { cachedResearch, research } from "../src/server/research";
import { parseScrape } from "../src/server/scrape";
import { workspaces } from "../src/server/workspace/store";
import { sampleProject } from "../src/video/sample";

const dataDir = mkdtempSync(join(tmpdir(), "shipcast-research-"));
process.env.RESEARCH_DATA_DIR = join(dataDir, "research");
process.env.WORKSPACE_DATA_DIR = join(dataDir, "workspaces");
const original = { ...providers };
const gateway = process.env.AI_GATEWAY_API_KEY;
after(async () => {
  Object.assign(providers, original);
  if (gateway === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = gateway;
  await rm(dataDir, { recursive: true, force: true });
});

const signal = new AbortController().signal;
let n = 0;
const fresh = () => `https://acme.dev/p${++n}`; // a new product URL per test keeps the 24h cache out of the way

// ---------- stubbed Exa: own pages, mentions and similar sites, salted with URLs that must be dropped ----------
type ExaKey = "/contents" | "/search" | "/search:company" | "/findSimilar";
function exaFor(site: string, overrides: Partial<Record<ExaKey, () => unknown>> = {}) {
  const host = new URL(site).hostname;
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const responses = {
    "/contents": () => ({ results: [{
      url: `${site}/`, title: "Acme", image: "https://cdn.example.com/og.png", favicon: `${site}/favicon.ico`,
      text: "# Acme\nShip **launch films** from a URL.\nTrusted by 10,000 creators. Rated 4.9 on G2.",
      extras: { imageLinks: [`${site}/hero.png`, `${site}/icon.svg`, "http://10.0.0.1/secret.png"] },
      subpages: [
        { url: `${site}/pricing`, title: "Pricing", text: "Free for one project. Pro is $12 a month." },
        { url: "http://169.254.169.254/latest", title: "metadata", text: "internal" },
        { url: `${site}/`, title: "dup", text: "duplicate" },
        { url: `${site}/blog`, title: "Blog", text: "" },
      ],
    }] }),
    "/search": () => ({ results: [
      { url: `https://blog.${host}/launch`, title: "Acme launch", highlights: ["acme"] },
      { url: "http://localhost/acme", title: "Acme local", highlights: ["acme"] },
      { url: "https://news.ycombinator.com/item?id=1", title: "Show HN: Acme", highlights: ["Acme turns URLs into films"], publishedDate: "2026-03-01T00:00:00.000Z" },
      { url: "https://reddit.com/r/saas/1", title: "Thoughts?", highlights: ["acme saved me a week"], publishedDate: "2026-09-01T00:00:00.000Z" },
      { url: "https://unrelated.com/post", title: "Something else", highlights: ["no brand here"] },
      { url: "https://acme-loyalty.io/blog", title: "Acme loyalty points for Shopify", highlights: ["Acme rewards shoppers"], publishedDate: "2026-10-20T00:00:00.000Z" },
    ] }),
    "/findSimilar": () => ({ results: [
      { url: `https://${host}/about`, title: "Acme about" },
      { url: "http://192.168.1.4/", title: "LAN" },
      { url: "https://rival.io/", title: "Rival", highlights: ["Rival edits videos by hand"] },
      { url: "https://rival.io/pricing", title: "Rival pricing" },
      { url: "https://www.producthunt.com/products/acme", title: "Acme on Product Hunt", highlights: ["Acme: launch films from a URL"], publishedDate: "2026-10-01T00:00:00.000Z" },
    ] }),
    "/search:company": () => ({ results: [
      { url: "https://other.app/", title: "Other", highlights: ["Other makes slides"] },
      { url: "https://rival.io/", title: "Rival", highlights: ["Rival edits videos by hand"] },
    ] }),
    ...overrides,
  };
  const exa: Providers["exa"] = async (path, body) => {
    const key: ExaKey = path === "/search" && (body as { category?: string }).category === "company" ? "/search:company" : path;
    calls.push({ path: key, body: body as Record<string, unknown> });
    return responses[key]();
  };
  return { exa, calls };
}

const draft = (site: string) => ({
  product: { name: "Acme", oneLiner: "Launch films from a URL", category: "Video", audience: "Founders", problem: "Launch videos take a week", sourceUrl: `${site}/` },
  features: [
    { name: "URL to film", benefit: "No editor needed", sourceUrl: `${site}/` },
    { name: "Invented", benefit: "Made up", sourceUrl: "https://made-up.example/" },
  ],
  proof: [
    { kind: "metric", text: "Trusted by 10,000 creators", sourceUrl: `${site}/` },
    { kind: "metric", text: "99% uptime", sourceUrl: `${site}/` },
    { kind: "quote", text: "Acme saved me a week", sourceUrl: "https://reddit.com/r/saas/1" },
    { kind: "quote", text: "Best tool ever made", sourceUrl: "https://reddit.com/r/saas/1" },
    { kind: "award", text: "Product of the day", sourceUrl: "https://nowhere.example/" },
  ],
  mentionUrls: ["https://reddit.com/r/saas/1", "https://news.ycombinator.com/item?id=1", "https://www.producthunt.com/products/acme", "https://made-up.example/x", `https://blog.${new URL(site).hostname}/launch`],
  competitors: [
    { name: "Rival", url: "https://rival.io", howDifferent: "Manual editing" },
    { name: "Ghost", url: "https://ghost-competitor.example", howDifferent: "Invented" },
    { name: "Product Hunt", url: "https://www.producthunt.com/products/acme", howDifferent: "A listing, not a rival" },
    { name: "Other", url: "https://other.app/", howDifferent: "Slides, not films" },
  ],
  voice: { adjectives: ["direct", "playful"], sampleLines: [{ text: "Ship launch films from a URL.", sourceUrl: `${site}/` }, { text: "We are the best", sourceUrl: `${site}/` }] },
});

type Seen = { system: string; data: Record<string, unknown> };
function deps(site: string, overrides?: Parameters<typeof exaFor>[1], film: unknown = { direction: { angle: "a", hook: "h", proofPoints: [], visualConcept: "v" }, project: sampleProject }) {
  const { exa, calls } = exaFor(site, overrides);
  const seen: Seen[] = [];
  const page = parseScrape({ success: true, data: { markdown: "# Acme", screenshot: "https://cdn.example.com/p.png", metadata: { ogSiteName: "Acme" } } }, `${site}/`);
  const stub: Providers = {
    exa,
    scrapeProduct: async () => page,
    structured: async (schema, system, data) => {
      seen.push({ system, data: data as Record<string, unknown> });
      return schema.parse(system.includes("product researcher") ? draft(site) : film);
    },
  };
  return { stub, calls, seen };
}

test("research merges subpages, mentions and similar sites, excludes the own domain and unsafe URLs", async () => {
  const site = fresh();
  const host = new URL(site).hostname;
  const { stub, calls, seen } = deps(site);
  const brief = researchBrief.parse(await research(site, signal, stub));

  assert.deepEqual(calls.map((c) => c.path).sort(), ["/contents", "/findSimilar", "/search", "/search:company"]);
  const by = Object.fromEntries(calls.map((c) => [c.path, c.body]));
  assert.equal(by["/contents"].subpages, 5);
  assert.ok((by["/contents"].subpageTarget as string[]).includes("pricing"));
  for (const path of ["/search", "/search:company", "/findSimilar"]) assert.deepEqual(by[path].excludeDomains, [host], path);
  assert.equal(by["/findSimilar"].excludeSourceDomain, true);
  assert.match(String(by["/search:company"].query), /^Alternatives to Acme: Acme Ship launch films from a URL/, "competitor search describes the product in its own words");

  const input = seen[0].data as { pages: { url: string }[]; candidates: { url: string }[] };
  assert.deepEqual(input.pages.map((p) => p.url), [`${site}/`, `${site}/pricing`], "deduped, public, with text");
  const candidateUrls = input.candidates.map((c) => c.url);
  assert.equal(candidateUrls.length, new Set(candidateUrls).size, "deduped across searches");
  assert.ok(candidateUrls.every((u) => !u.includes(host) && !/localhost|192\.168|10\.0\.0/.test(u)), "never own domain or private hosts");
  assert.deepEqual(brief.mentions.map((m) => m.url), ["https://www.producthunt.com/products/acme", "https://reddit.com/r/saas/1", "https://news.ycombinator.com/item?id=1"], "only pages about this product, recent first");
  assert.equal(brief.mentions[1].source, "reddit.com");

  const all = JSON.stringify(brief);
  for (const bad of ["10.0.0.1", "169.254.169.254", "localhost", "192.168.1.4", `blog.${host}`, "made-up.example", "ghost-competitor", "nowhere.example", "acme-loyalty", "unrelated.com"]) {
    assert.ok(!all.includes(bad), bad);
  }
  assert.deepEqual(brief.features.map((f) => f.name), ["URL to film"]);
  assert.deepEqual(brief.competitors.map((c) => c.url), ["https://rival.io/", "https://other.app/"], "real rivals only, never a listing of this product");
  assert.deepEqual(brief.voice.sampleLines.map((l) => l.text), ["Ship launch films from a URL."], "only verbatim site lines");
  assert.deepEqual(brief.visuals, [
    { url: "https://cdn.example.com/og.png", kind: "og" },
    { url: `${site}/favicon.ico`, kind: "logo" },
    { url: `${site}/hero.png`, kind: "screenshot" },
  ]);
});

test("every proof item cites a fetched source and states what the source states", async () => {
  const site = fresh();
  const brief = await research(site, signal, deps(site).stub);
  assert.deepEqual(brief.proof.map((p) => p.text), ["Trusted by 10,000 creators", "Acme saved me a week"]);
  const sources = new Set(brief.sources.map((s) => s.url));
  assert.ok(brief.proof.every((p) => sources.has(p.sourceUrl)));
  assert.ok([brief.product, ...brief.features, ...brief.voice.sampleLines].every((c) => sources.has(c.sourceUrl)));
});

test("research degrades gracefully when search or findSimilar fail, but not when the site can't be read", async () => {
  const site = fresh();
  const down = () => { throw new ApiError(502, "Exa down"); };
  const brief = await research(site, signal, deps(site, { "/search": down, "/search:company": down, "/findSimilar": down }).stub);
  assert.deepEqual([brief.mentions, brief.competitors], [[], []]);
  assert.equal(brief.features.length, 1);
  const other = fresh();
  await assert.rejects(research(other, signal, deps(other, { "/contents": down }).stub), (e: Error) => e instanceof ApiError && e.status === 502);
  await assert.rejects(research(other, signal, deps(other, { "/contents": () => ({ results: [{ url: `${other}/`, text: "" }] }) }).stub), ApiError);
  assert.equal(await cachedResearch(other), null, "failures are never cached");
});

test("SSRF guard: private product URLs never reach Exa", async () => {
  for (const url of ["http://localhost", "http://10.0.0.1", "http://[::1]", "file:///etc/passwd"]) {
    const { stub, calls } = deps("https://x.dev");
    await assert.rejects(research(url, signal, stub), ApiError, url);
    assert.equal(calls.length, 0);
  }
});

test("cache: a hit within 24h avoids every provider call; URL variants share it; stale entries are refetched", async () => {
  const site = fresh();
  const first = await research(site, signal, deps(site).stub);
  const files = await readdir(process.env.RESEARCH_DATA_DIR!);
  assert.ok(files.every((f) => f.endsWith(".json")), "atomic write leaves no temp files");
  const { stub, calls, seen } = deps(site);
  const variant = site.replace("https://", "https://www.") + "/?ref=x";
  assert.deepEqual(await research(variant, signal, stub), first);
  assert.deepEqual([calls.length, seen.length], [0, 0]);

  let aged = 0;
  for (const f of files) {
    const path = join(process.env.RESEARCH_DATA_DIR!, f);
    const cached = JSON.parse(await readFile(path, "utf8")) as ResearchBrief;
    if (cached.url !== first.url) continue;
    await writeFile(path, JSON.stringify({ ...cached, researchedAt: new Date(Date.now() - 25 * 3_600_000).toISOString() }));
    aged++;
  }
  assert.equal(aged, 1);
  assert.equal(await cachedResearch(site), null);
  await research(site, signal, stub);
  assert.equal(calls.length, 4, "stale cache is refreshed");
});

test("generate writes the film from the research brief and returns it; kit reuses the cached brief", async () => {
  const site = fresh();
  const { stub, seen } = deps(site);
  process.env.AI_GATEWAY_API_KEY = "test-only";
  Object.assign(providers, stub);
  const response = await generatePost(new Request("http://localhost/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: site }) }));
  assert.equal(response.status, 200);
  const body = generateResponse.parse(await response.json());
  assert.equal(body.research?.product.name, "Acme");
  const film = seen.find((s) => s.system.includes("creative director"))!;
  assert.match(film.system, /story angle/);
  assert.equal((film.data.research as ResearchBrief).features[0].name, "URL to film");

  const project = { ...sampleProject, scenes: sampleProject.scenes.map((s) => ({ ...s, layers: s.layers.map((l) => (l.type === "cta" ? { ...l, url: `${site}/` } : l)) })) };
  await generateKit({ project, channels: ["x"] }, signal, { ...stub, structured: async (schema, system, data) => {
    assert.match(system, /research brief/);
    assert.equal((data as { research: ResearchBrief }).research.product.name, "Acme");
    return schema.parse({ posts: [{ channelId: "x", text: "Acme" }] });
  } });
  await generateKit({ project: sampleProject, channels: ["x"] }, signal, { ...stub, structured: async (schema, system, data) => {
    assert.equal((data as { research?: unknown }).research, undefined, "no research for an unresearched URL");
    return schema.parse({ posts: [{ channelId: "x", text: "Acme" }] });
  } });
  Object.assign(providers, original);
});

test("POST /api/research validates input and output and charges 1 credit only on success", async () => {
  const site = fresh();
  process.env.AI_GATEWAY_API_KEY = "test-only";
  const { workspace, token } = await workspaces().create();
  const post = (body: unknown, cookie = true) => researchPost(new Request("http://localhost/api/research", {
    method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie: `shipcast_ws=${token}` } : {}) }, body: JSON.stringify(body),
  }));
  const credits = async () => (await workspaces().get(workspace.id))!.credits;
  try {
    assert.equal((await post({ url: "nope" })).status, 400);
    assert.equal((await post({ url: "http://127.0.0.1" })).status, 400);
    assert.equal(await credits(), 20, "invalid input is never billed");

    Object.assign(providers, deps(site, { "/contents": () => { throw new ApiError(502, "secret upstream"); } }).stub);
    const failed = await post({ url: site });
    assert.equal(failed.status, 502);
    assert.equal(await credits(), 20, "failed research is refunded");

    Object.assign(providers, deps(site).stub);
    const ok = await post({ url: site });
    assert.equal(ok.status, 200);
    assert.equal(researchBrief.parse(await ok.json()).url, new URL(site).href);
    assert.equal(await credits(), 19);
    assert.equal((await post({ url: site }, false)).status, 200, "anonymous works and is free");
    assert.equal(await credits(), 19);
  } finally {
    Object.assign(providers, original);
  }
});
