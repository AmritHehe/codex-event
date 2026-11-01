import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PUBLISH_CHANNELS, publishRequest } from "../src/lib/distribution-contracts";
import { connections, publish } from "../src/server/distribution/adapters";
import { PublicationLedger } from "../src/server/distribution/ledger";
import { createPublishHandler } from "../src/server/distribution/service";
import { popularTemplates } from "../src/server/distribution/templates";
import { memeSvg } from "../src/distribution/meme";
import { sampleProject } from "../src/video/sample";

const original = { ...process.env };
const token = "test-publishing-key-32-characters";
after(() => { for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
const input = (patch: Record<string, unknown> = {}) => publishRequest.parse({ requestId: randomUUID(), channel: "x", text: "Meet our product", ...patch });
const request = (data: unknown, key = token) => new Request("http://localhost/api/distribution/publish", { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(data) });

test("validation excludes draft-only destinations and invalid media/schedule combinations", () => {
  for (const channel of ["reddit", "product-hunt", "hacker-news"]) assert.throws(() => input({ channel }));
  assert.throws(() => input({ channel: "x", mediaUrl: "https://example.com/video.mp4" }));
  assert.throws(() => input({ channel: "x", renderJobId: randomUUID() }));
  assert.throws(() => input({ channel: "tiktok", renderJobId: randomUUID(), mediaUrl: "https://example.com/video.mp4" }));
  assert.throws(() => input({ channel: "threads", scheduleAt: "2030-01-01T00:00:00Z" }));
  assert.throws(() => input({ channel: "youtube-shorts" }));
  assert.throws(() => input({ channel: "pinterest", mediaUrl: "https://example.com/photo.png" }));
  assert.throws(() => input({ channel: "tiktok", mediaUrl: "file:///tmp/video.mp4" }));
  assert.throws(() => input({ channel: "x", text: "x".repeat(281) }));
});

test("all nine destination adapters use the official API shapes without live requests", async () => {
  Object.assign(process.env, {
    X_USER_ACCESS_TOKEN: "test-x-token", BLUESKY_IDENTIFIER: "test.bsky.social", BLUESKY_APP_PASSWORD: "test-password",
    THREADS_USER_ID: "1234", THREADS_ACCESS_TOKEN: "test-threads-token", MASTODON_BASE_URL: "https://mastodon.example", MASTODON_ACCESS_TOKEN: "test-mastodon-token",
    TELEGRAM_BOT_TOKEN: "test-bot-token", TELEGRAM_CHAT_ID: "@test", AYRSHARE_API_KEY: "test-aggregator-token",
  });
  const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    const isForm = init?.body instanceof URLSearchParams;
    const body = isForm ? Object.fromEntries(init.body as URLSearchParams) : JSON.parse(String(init?.body));
    calls.push({ url: String(url), body, headers: new Headers(init?.headers) });
    if (String(url).includes("createSession")) return Response.json({ did: "did:plc:test", accessJwt: "test-jwt" });
    if (String(url).includes("createRecord")) return Response.json({ uri: "at://did:plc:test/app.bsky.feed.post/record1" });
    if (String(url).includes("api.x.com")) return Response.json({ data: { id: "x1" } });
    if (String(url).includes("telegram.org")) return Response.json({ ok: true, result: { message_id: 12 } });
    if (String(url).includes("mastodon")) return Response.json({ id: "m1", url: "https://mastodon.example/@test/1" });
    if (String(url).includes("ayrshare")) return Response.json({ status: "success", id: "a1", postIds: [{ status: "success" }] });
    return Response.json({ id: "threads1" });
  };
  for (const channel of PUBLISH_CHANNELS) {
    const media = ["tiktok", "youtube-shorts", "pinterest"].includes(channel.id);
    const data = input({ channel: channel.id, ...(media && { mediaUrl: "https://cdn.example.com/asset.mp4" }), ...(channel.id === "youtube-shorts" && { title: "Launch video" }), ...(channel.id === "pinterest" && { boardId: "12345" }), ...(channel.mode === "aggregator" && { scheduleAt: "2030-01-01T00:00:00Z" }) });
    const receipt = await publish(data, new AbortController().signal, fakeFetch);
    assert.equal(receipt.channel, channel.id);
    assert.equal(receipt.status, channel.mode === "direct" ? "published" : "scheduled");
  }
  assert.ok(connections().every((c) => c.configured));
  assert.equal(calls.find((c) => c.url.includes("graph.threads.net"))!.body.auto_publish_text, "true");
  const aggregators = calls.filter((c) => c.url.includes("ayrshare"));
  assert.equal(aggregators.length, 4);
  assert.ok(aggregators.every((c) => c.body.scheduleDate === "2030-01-01T00:00:00Z" && typeof c.body.idempotencyKey === "string"));
  assert.deepEqual(aggregators.find((c) => (c.body.platforms as string[])[0] === "youtube")?.body.youTubeOptions, { title: "Launch video", shorts: true, visibility: "private" });
  assert.ok(calls.find((c) => c.url.includes("mastodon"))?.headers.has("Idempotency-Key"));
  await assert.rejects(publish(input(), new AbortController().signal, async () => new Response("secret upstream details", { status: 403 })), (e: Error) => !e.message.includes("secret"));
});

test("authenticated publishing persists receipts and never repeats the same operation", async () => {
  process.env.DISTRIBUTION_TOKEN = token;
  const dir = await mkdtemp(join(tmpdir(), "shipcast-publish-test-"));
  const ledger = new PublicationLedger(dir);
  let calls = 0;
  const handler = createPublishHandler({ ledger, requireConnection: () => {}, publish: async (data) => { calls++; return { requestId: data.requestId, channel: data.channel, providerId: "test-post", status: "published" }; } });
  const data = input();
  try {
    assert.equal((await handler(request(data, "incorrect-key"))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await handler(request(data))).status, 200);
    assert.equal((await handler(request(data))).status, 200);
    assert.equal(calls, 1);
    const receipt = await new PublicationLedger(dir).reserve(data);
    assert.equal(receipt?.providerId, "test-post");
    assert.equal((await handler(request({ ...data, text: "A different draft" }))).status, 409);
    assert.equal((await handler(request({ ...data, requestId: randomUUID(), channel: "reddit" }))).status, 400);
    assert.equal((await handler(request({ ...data, requestId: randomUUID(), channel: "linkedin-page", scheduleAt: "2020-01-01T00:00:00Z" }))).status, 400);
    const oldSchedule = input({ channel: "linkedin-page", scheduleAt: "2020-01-01T00:00:00Z" });
    await ledger.reserve(oldSchedule);
    await ledger.finish(oldSchedule, { requestId: oldSchedule.requestId, channel: oldSchedule.channel, providerId: "already-scheduled", status: "scheduled" });
    assert.equal((await handler(request(oldSchedule))).status, 200);
    delete process.env.DISTRIBUTION_TOKEN;
    assert.equal((await handler(request(input()))).status, 503);
    assert.ok(!(await readFile(join(dir, "posts.json"), "utf8")).includes(token));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("concurrent and interrupted attempts fail closed rather than duplicating posts", async () => {
  process.env.DISTRIBUTION_TOKEN = token;
  const dir = await mkdtemp(join(tmpdir(), "shipcast-ledger-test-"));
  const ledger = new PublicationLedger(dir);
  const data = input();
  try {
    const reservations = await Promise.allSettled([ledger.reserve(data), ledger.reserve(data)]);
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 1);
    let calls = 0;
    const handler = createPublishHandler({ ledger, requireConnection: () => {}, publish: async () => { calls++; throw new Error("secret-token"); } });
    assert.equal((await handler(request(data))).status, 409);
    assert.equal(calls, 0);
    const other = input();
    const failed = await handler(request(other));
    assert.equal(failed.status, 502); assert.ok(!(await failed.text()).includes("secret-token"));
    assert.equal((await handler(request(other))).status, 409); assert.equal(calls, 1);
    await writeFile(join(dir, "posts.json"), "corrupt");
    assert.equal((await handler(request(input()))).status, 503); assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("render publishing authenticates first, resolves media and recovers receipts without the render server", async () => {
  process.env.DISTRIBUTION_TOKEN = token;
  const dir = await mkdtemp(join(tmpdir(), "shipcast-render-publish-test-"));
  let resolutions = 0;
  let publications = 0;
  const data = input({ channel: "tiktok", renderJobId: randomUUID() });
  const handler = createPublishHandler({
    ledger: new PublicationLedger(dir), requireConnection: () => {},
    resolveRenderMedia: async (id) => {
      assert.equal(id, data.renderJobId);
      resolutions++;
      if (resolutions > 1) throw new Error("Render server restarted");
      return "https://example.com/completed.mp4";
    },
    publish: async (resolved) => {
      publications++;
      assert.equal(resolved.mediaUrl, "https://example.com/completed.mp4");
      return { requestId: resolved.requestId, channel: resolved.channel, providerId: "uploaded-video", status: "submitted" };
    },
  });
  try {
    assert.equal((await handler(request(data, "wrong-key"))).status, 401);
    assert.equal(resolutions, 0);
    const first = await handler(request(data));
    assert.equal(first.status, 200);
    const retry = await handler(request(data));
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), await first.json());
    assert.equal(resolutions, 1);
    assert.equal(publications, 1);
    assert.equal((await handler(request({ ...data, text: "Changed draft" }))).status, 409);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("popular templates only proxy trusted Imgflip assets and compositions escape captions", async () => {
  const templates = await popularTemplates(new AbortController().signal, async () => Response.json({ success: true, data: { memes: [
    { id: "1", name: "Test", url: "https://i.imgflip.com/test.jpg", width: 500, height: 500 },
    { id: "2", name: "Untrusted", url: "https://other.example/test.jpg", width: 500, height: 500 },
  ] } }));
  assert.equal(templates.length, 1);
  const svg = memeSvg("data:image/png;base64,YQ==", "</text><script>alert(1)</script>", "Launch", sampleProject);
  assert.ok(!svg.includes("<script>")); assert.match(svg, /&lt;/); assert.ok(svg.includes(sampleProject.name));
  assert.throws(() => memeSvg("https://private.example/image", "top", "bottom", sampleProject));
});
