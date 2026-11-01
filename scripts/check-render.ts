import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createRenderServer } from "../server/http";
import { RenderQueue } from "../server/queue";
import { workerTask } from "../server/worker-task";
import { sampleProject } from "../src/video/sample";

const tick = () => new Promise((r) => setTimeout(r, 5));
async function until(check: () => boolean) {
  for (let i = 0; i < 200; i++) { if (check()) return; await tick(); }
  assert.fail("Job did not reach expected state");
}

test("queue serializes jobs, clamps progress and advances after a crashed render", async () => {
  let release = () => {};
  let running = 0;
  let maxRunning = 0;
  let calls = 0;
  const queue = new RenderQueue(async (_project, _id, report) => {
    running++; maxRunning = Math.max(maxRunning, running); calls++;
    report(NaN); report(1.5); report(-1);
    await new Promise<void>((resolve) => { release = resolve; });
    running--;
    if (calls === 1) throw new Error("Simulated renderer crash");
  });
  const first = queue.enqueue(sampleProject);
  const second = queue.enqueue(sampleProject);
  assert.equal(first.status, "queued");
  await until(() => calls === 1);
  assert.equal(queue.get(second.jobId)?.status, "queued");
  assert.equal(queue.get(first.jobId)?.progress, 0.99);
  release();
  await until(() => calls === 2);
  assert.equal(queue.get(first.jobId)?.status, "error");
  release();
  await until(() => queue.get(second.jobId)?.status === "done");
  assert.equal(maxRunning, 1);
  assert.equal(queue.get(second.jobId)?.url, `/files/${second.jobId}.mp4`);
  queue.close();
});

test("HTTP validates input, applies CORS, reports jobs and serves only completed MP4s", async () => {
  const out = await mkdtemp(join(tmpdir(), "shipcast-render-test-"));
  const queue = new RenderQueue(async (_project, id, report) => { report(0.5); await writeFile(join(out, `${id}.mp4`), "test-mp4"); });
  const server = createRenderServer(queue, out);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const post = (body: unknown) => fetch(`${url}/render`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(body) });
  try {
    const response = await post({ project: sampleProject });
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
    const job = await response.json();
    await until(() => queue.get(job.jobId)?.status === "done");
    const status = await (await fetch(`${url}/render/${job.jobId}`)).json();
    assert.equal(status.progress, 1);
    const file = await fetch(`${url}${status.url}`);
    assert.equal(file.status, 200); assert.equal(file.headers.get("content-type"), "video/mp4");
    assert.match(file.headers.get("content-disposition")!, /attachment/);
    assert.equal(await file.text(), "test-mp4");
    assert.equal((await post({ project: {} })).status, 400);
    assert.equal((await post({ data: "x".repeat(1_048_577) })).status, 413);
    assert.equal((await fetch(`${url}/render`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400);
    assert.equal((await fetch(`${url}/render`, { method: "POST", body: "{}" })).status, 415);
    assert.equal((await fetch(`${url}/render`, { method: "OPTIONS", headers: { origin: "http://localhost:3000" } })).status, 204);
    assert.equal((await fetch(`${url}/render`, { method: "OPTIONS", headers: { origin: "https://untrusted.example" } })).status, 403);
    assert.equal((await fetch(`${url}/render/00000000-0000-0000-0000-000000000000`)).status, 404);
    assert.equal((await fetch(`${url}/files/../../package.json`)).status, 404);
    assert.equal((await fetch(`${url}/files/00000000-0000-0000-0000-000000000000.mp4`)).status, 404);
  } finally {
    queue.close(); server.close(); await once(server, "close"); await rm(out, { recursive: true, force: true });
  }
});

test("full/closed queues reject new work and shutdown marks waiting jobs as errors", () => {
  const queue = new RenderQueue(async () => {}, 1);
  const job = queue.enqueue(sampleProject);
  assert.throws(() => queue.enqueue(sampleProject), /full/);
  queue.close();
  assert.equal(queue.get(job.jobId)?.status, "error");
  assert.throws(() => queue.enqueue(sampleProject), /shutting down/);
});

test("worker watchdog kills a hung process, cleans partial output and frees the queue", async () => {
  await mkdir("out", { recursive: true });
  const root = await mkdtemp(resolve("out/worker-test-"));
  await mkdir(join(root, "server"));
  await writeFile(join(root, "server/render-worker.ts"), `
    const fs = require('node:fs');
    process.once('message', (input) => {
      fs.writeFileSync(input.outputLocation, 'partial');
      if (input.project.name === 'hang') setInterval(() => {}, 100);
      else { process.send({type:'done'}); process.disconnect(); }
    });
  `);
  const queue = new RenderQueue(workerTask(root, "unused", root, 800));
  try {
    const hung = queue.enqueue({ ...sampleProject, name: "hang" });
    const next = queue.enqueue(sampleProject);
    for (let i = 0; i < 600 && queue.get(next.jobId)?.status !== "done"; i++) await tick();
    assert.equal(queue.get(hung.jobId)?.status, "error");
    assert.match(queue.get(hung.jobId)?.error ?? "", /timed out/);
    assert.equal(queue.get(next.jobId)?.status, "done");
    await assert.rejects(stat(join(root, `${hung.jobId}.mp4`)), { code: "ENOENT" });
  } finally { queue.close(); await rm(root, { recursive: true, force: true }); }
});
