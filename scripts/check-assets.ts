import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { RenderQueue } from "../server/queue";
import { sampleProject } from "../src/video/sample";
import { decodeImage } from "../src/server/assets/blob";
import { resolveRenderMedia } from "../src/server/assets/render-media";
import { publishRequest } from "../src/lib/distribution-contracts";
test("image signatures and types are checked before upload", () => {
  assert.throws(() => decodeImage("data:image/png;base64,YQ=="));
  assert.throws(() => decodeImage("data:image/svg+xml;base64,YQ=="));
  assert.equal(decodeImage("data:image/png;base64,iVBORw0KGgo=").type, "image/png");
});
test("publish accepts render IDs for aggregator media", () => {
  assert.ok(publishRequest.safeParse({ requestId: randomUUID(), channel: "tiktok", text: "Launch", renderJobId: randomUUID() }).success);
});
test("render media resolution rejects missing, unfinished and local media", async () => {
  const id = randomUUID();
  const fake = (body: unknown): typeof fetch => async () => Response.json(body);
  await assert.rejects(resolveRenderMedia(id, fake({ jobId: id, status: "rendering", progress: .5 })));
  await assert.rejects(resolveRenderMedia(id, fake({ jobId: id, status: "done", progress: 1, url: "/files/test.mp4" })));
  await assert.rejects(resolveRenderMedia(id, async () => new Response(null, { status: 404 })));
  assert.equal(await resolveRenderMedia(id, fake({ jobId: id, status: "done", progress: 1, url: "https://example.public.blob.vercel-storage.com/test.mp4" })), "https://example.public.blob.vercel-storage.com/test.mp4");
});
test("queue exposes the uploaded URL only after the render task finishes", async () => {
  let finish: (value: string) => void = () => {};
  const queue = new RenderQueue(async () => new Promise<string>((resolve) => { finish = resolve; }));
  const job = queue.enqueue(sampleProject); await new Promise((r) => setTimeout(r, 0));
  assert.equal(queue.get(job.jobId)?.status, "rendering");
  finish("https://example.public.blob.vercel-storage.com/video.mp4"); await new Promise((r) => setTimeout(r, 0));
  assert.equal(queue.get(job.jobId)?.url, "https://example.public.blob.vercel-storage.com/video.mp4"); queue.close();
});
