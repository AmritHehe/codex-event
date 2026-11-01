import assert from "node:assert/strict";
import { after, test } from "node:test";
import { z } from "zod";
import { POST as generatePost } from "../src/app/api/generate/route";
import { POST as editPost } from "../src/app/api/edit/route";
import { POST as kitPost } from "../src/app/api/kit/route";
import { applyEdits } from "../src/server/edits";
import { validateProject } from "../src/server/project";
import { generate } from "../src/server/generation";
import { generateKit } from "../src/server/kit";
import { providers, type Providers } from "../src/server/providers";
import { ApiError, jsonRoute } from "../src/server/http";
import { parseScrape, publicUrl, scrapeProduct } from "../src/server/scrape";
import { sampleProject } from "../src/video/sample";

const source = {
  success: true,
  data: {
    markdown: "# Acme\nTurn product URLs into editable videos.",
    screenshot: "https://cdn.example.com/product.png",
    metadata: { ogSiteName: "Acme", description: "Product launch videos" },
    branding: { colors: { primary: "#ff4f17", secondary: "#fff", background: null }, logo: "/logo.png" },
  },
};
const page = parseScrape(source, "https://example.com/");
const signal = new AbortController().signal;
const request = (data: unknown) => new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
const deps = (result: unknown): Providers => ({ scrapeProduct: async () => page, structured: async (schema) => schema.parse(result) });
const original = { ...providers };
const key = process.env.AI_GATEWAY_API_KEY;
const oidc = process.env.VERCEL_OIDC_TOKEN;
after(() => {
  Object.assign(providers, original);
  if (key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = key;
  if (oidc === undefined) delete process.env.VERCEL_OIDC_TOKEN; else process.env.VERCEL_OIDC_TOKEN = oidc;
});

test("scrape extracts brand, normalizes relative logo and rejects missing screenshots", () => {
  assert.equal(page.brand.logo, "https://example.com/logo.png");
  assert.deepEqual(page.brand.colors, ["#ff4f17", "#fff"]);
  assert.throws(() => parseScrape({ success: true, data: { markdown: "ok" } }, page.url), ApiError);
  assert.throws(() => parseScrape({ success: false }, page.url), ApiError);
});

test("only public http(s) URLs without credentials are sent to Firecrawl", () => {
  for (const url of ["file:///etc/passwd", "ftp://example.com", "http://localhost", "http://127.1", "http://10.0.0.1", "http://169.254.169.254", "http://[::1]", "http://user:pass@example.com", "http://a.internal"]) {
    assert.throws(() => publicUrl(url), ApiError, url);
  }
  assert.equal(publicUrl("https://example.com"), "https://example.com/");
});

test("Firecrawl request includes markdown, branding and screenshot and hides upstream errors", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-only";
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.firecrawl.dev/v2/scrape");
      assert.deepEqual(JSON.parse(String(init?.body)).formats, ["markdown", "branding", { type: "screenshot", fullPage: false }]);
      return Response.json(source);
    };
    assert.deepEqual(await scrapeProduct(page.url, signal), page);
    globalThis.fetch = async () => new Response("secret upstream details", { status: 402 });
    await assert.rejects(scrapeProduct(page.url, signal), (e: Error) => !e.message.includes("secret") && e instanceof ApiError && e.status === 502);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = oldKey;
  }
});

test("generation uses the scraped screenshot, including when the model omits media", async () => {
  const result = await generate(page.url, signal, deps(sampleProject));
  const images = result.project.scenes.flatMap((s) => s.layers).filter((l) => l.type === "image");
  assert.ok(images.length);
  assert.ok(images.every((l) => l.src === page.brand.screenshot));
  const noImages = { ...sampleProject, scenes: sampleProject.scenes.map((s) => ({ ...s, layers: s.layers.filter((l) => l.type !== "image") })) };
  const added = await generate(page.url, signal, deps(noImages));
  assert.ok(added.project.scenes.flatMap((s) => s.layers).some((l) => l.type === "image" && l.src === page.brand.screenshot));
});

test("targeted edits preserve untouched IDs and objects without mutating input", () => {
  const before = JSON.stringify(sampleProject);
  const result = applyEdits(sampleProject, { summary: "Shortened hook", operations: [{ op: "replace-layer", sceneId: "hook", layerId: "h2", layer: { id: "model-changed-id", type: "text", role: "headline", text: "Ship it" } }] });
  assert.equal(result.project.scenes[0].layers[1].id, "h2");
  assert.equal(result.project.scenes[0].layers[0], sampleProject.scenes[0].layers[0]);
  assert.equal(result.project.scenes[1], sampleProject.scenes[1]);
  assert.equal(JSON.stringify(sampleProject), before);
  assert.throws(() => applyEdits(sampleProject, { summary: "Bad", operations: [{ op: "delete-layer", sceneId: "hook", layerId: "missing" }] }), ApiError);
  assert.throws(() => applyEdits({ ...sampleProject, scenes: [sampleProject.scenes[0]] }, { summary: "Bad", operations: [{ op: "delete-scene", sceneId: "hook" }] }), ApiError);
  assert.throws(() => validateProject({ ...sampleProject, scenes: [...sampleProject.scenes, sampleProject.scenes[0]] }), ApiError);
});

test("kit deduplicates requested channels and rejects missing, duplicate or unsupported posts", async () => {
  const input = { project: sampleProject, channels: ["x", "x", "product-hunt"] };
  const posts = [{ channelId: "x", text: "A launch thread" }, { channelId: "product-hunt", text: "Editable product videos" }];
  assert.deepEqual(await generateKit(input, signal, deps({ posts })), { posts });
  await assert.rejects(generateKit(input, signal, deps({ posts: [posts[0], posts[0]] })), ApiError);
  await assert.rejects(generateKit(input, signal, deps({ posts: [posts[0]] })), ApiError);
  await assert.rejects(generateKit({ ...input, channels: ["unknown"] }, signal, deps({ posts })), (e: Error) => e instanceof ApiError && e.status === 400);
  // Any catalog channel works (briefed from its research notes); manual-only channels are refused.
  const reddit = [{ channelId: "reddit", text: "We built this after hitting the problem" }];
  assert.deepEqual(await generateKit({ project: sampleProject, channels: ["reddit"] }, signal, deps({ posts: reddit })), { posts: reddit });
  await assert.rejects(generateKit({ project: sampleProject, channels: ["hacker-news"] }, signal, deps({ posts })), (e: Error) => e instanceof ApiError && e.status === 400);
});

test("actual API routes validate requests and responses end to end with stubbed providers", async () => {
  process.env.AI_GATEWAY_API_KEY = "test-only";
  Object.assign(providers, deps(sampleProject));
  const generated = await generatePost(request({ url: page.url }));
  assert.equal(generated.status, 200);
  assert.equal((await generated.json()).brand.name, "Acme");
  Object.assign(providers, deps({ summary: "Blue accent", operations: [{ op: "theme", patch: { accent: "#123456" } }] }));
  const edited = await editPost(request({ project: sampleProject, instruction: "Make the accent blue" }));
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).project.theme.accent, "#123456");
  Object.assign(providers, deps({ posts: [{ channelId: "x", text: "Ship loud" }] }));
  assert.equal((await kitPost(request({ project: sampleProject, channels: ["x"] }))).status, 200);
  assert.equal((await generatePost(request({ url: "bad" }))).status, 400);
  assert.equal((await editPost(request({ project: sampleProject, instruction: "" }))).status, 400);
  assert.equal((await kitPost(request({ project: sampleProject, channels: [] }))).status, 400);
  assert.equal((await editPost(new Request("http://localhost/api/edit", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await kitPost(new Request("http://localhost/api/kit", { method: "POST", body: "{}" }))).status, 415);
  assert.equal((await kitPost(request({ huge: "x".repeat(1_048_577) }))).status, 413);
});

test("missing config, provider failures and timeouts return actionable, sanitized errors", async () => {
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  const unavailable = await generatePost(request({ url: page.url }));
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /AI_GATEWAY_API_KEY/);
  const route = jsonRoute(z.object({}), z.object({ ok: z.boolean() }), async () => { throw new Error("secret-token"); });
  const failed = await route(request({}));
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("secret-token"));
  const timeout = jsonRoute(z.object({}), z.object({}), async () => { throw new DOMException("timed out", "TimeoutError"); });
  assert.equal((await timeout(request({}))).status, 504);
});
