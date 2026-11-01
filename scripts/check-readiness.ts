import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { limit, sameOrigin } from "../src/server/limits";
import { charge } from "../src/server/workspace/http";
import { workspaces } from "../src/server/workspace/store";
import { validateImage } from "../src/server/assets/blob";
import { RenderQueue } from "../server/queue";
import { createRenderServer } from "../server/http";
import { sampleProject } from "../src/video/sample";
import { POST as startRender } from "../src/app/api/render/route";
import { GET as statusRender } from "../src/app/api/render/[id]/route";
import { ownedRender } from "../src/server/render-client";

const original = { ...process.env };
const dir = mkdtempSync(join(tmpdir(), "shipcast-readiness-"));
process.env.WORKSPACE_DATA_DIR = join(dir, "workspaces");
process.env.LIMIT_DATA_DIR = join(dir, "limits");
process.env.RENDER_DATA_DIR = join(dir, "owners");
after(async () => {
  for (const key of Object.keys(process.env))
    if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  await rm(dir, { recursive: true, force: true });
});

test("daily caps are atomic, persist across calls, and cannot be bypassed by concurrent attempts", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => limit("parallel", 3)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  await assert.rejects(
    limit("parallel", 3),
    (e: Error & { status: number }) => e.status === 429,
  );
  await assert.rejects(
    limit("invalid", NaN),
    (e: Error & { status: number }) => e.status === 503,
  );
});

test("paid calls require a workspace, reject foreign origins, debit success and refund failure", async () => {
  delete process.env.ALLOW_ANONYMOUS_AI;
  let calls = 0;
  await assert.rejects(
    charge(new Request("http://localhost/api/edit"), 1, async () => calls++),
    (e: Error & { status: number }) => e.status === 401,
  );
  assert.equal(calls, 0);
  const { workspace, token } = await workspaces().create();
  const request = (origin = "http://localhost") =>
    new Request("http://localhost/api/edit", {
      method: "POST",
      headers: { cookie: `shipcast_ws=${token}`, origin },
    });
  await assert.rejects(
    charge(request("https://attacker.example"), 1, async () => calls++),
    (e: Error & { status: number }) => e.status === 403,
  );
  await charge(request(), 1, async () => calls++);
  assert.equal((await workspaces().get(workspace.id))?.credits, 19);
  await assert.rejects(
    charge(request(), 1, async () => {
      throw new Error("provider failed");
    }),
  );
  assert.equal((await workspaces().get(workspace.id))?.credits, 19);
});

test("signature-only or corrupt images cannot be uploaded", async () => {
  await assert.rejects(
    validateImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  );
  await assert.rejects(validateImage(Buffer.from([255, 216, 255])));
});

test("private render service, authenticated proxy, workspace ownership and restart recovery", async () => {
  const key = "readiness-render-key-at-least-24-chars";
  process.env.RENDER_API_TOKEN = key;
  const history = join(dir, "jobs");
  const queue = new RenderQueue(
    async () => "https://cdn.example.com/complete.mp4",
    20,
    history,
  );
  const server = createRenderServer(queue, dir);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  process.env.RENDER_SERVICE_URL = `http://127.0.0.1:${address.port}`;
  const { workspace, token } = await workspaces().create();
  try {
    const unauthorized = await fetch(
      `${process.env.RENDER_SERVICE_URL}/render`,
      { method: "POST" },
    );
    assert.equal(unauthorized.status, 401);
    const foreign = await startRender(
      new Request("http://localhost/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: sampleProject }),
      }),
    );
    assert.equal(foreign.status, 401);
    const response = await startRender(
      new Request("http://localhost/api/render", {
        method: "POST",
        headers: {
          cookie: `shipcast_ws=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ project: sampleProject }),
      }),
    );
    assert.equal(response.status, 200);
    const job = await response.json();
    await new Promise((r) => setTimeout(r, 10));
    const status = await statusRender(
      new Request("http://localhost/api/render/x", {
        headers: { cookie: `shipcast_ws=${token}` },
      }),
      { params: Promise.resolve({ id: job.jobId }) },
    );
    assert.equal(status.status, 200);
    assert.equal((await status.json()).status, "done");
    const other = await workspaces().create();
    await assert.rejects(ownedRender(other.workspace.id, job.jobId));
    const denied = await fetch(
      `${process.env.RENDER_SERVICE_URL}/render/${job.jobId}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "X-Workspace-Id": other.workspace.id,
        },
      },
    );
    assert.equal(denied.status, 404);
    const restored = new RenderQueue(async () => {}, 20, history);
    assert.equal(restored.get(job.jobId)?.status, "done");
    assert.equal(restored.owns(job.jobId, workspace.id), true);
    restored.close();
  } finally {
    queue.close();
    server.close();
    await once(server, "close");
  }
});

test("origin validation accepts the external Host and production never permits anonymous AI", async()=>{
  assert.doesNotThrow(()=>sameOrigin(new Request("http://0.0.0.0:3000/api/workspace",{headers:{host:"shipcast.example",origin:"https://shipcast.example"}})));
  assert.throws(()=>sameOrigin(new Request("http://0.0.0.0:3000/api/workspace",{headers:{host:"shipcast.example",origin:"https://attacker.example"}})));
  const previous={node:process.env.NODE_ENV,anonymous:process.env.ALLOW_ANONYMOUS_AI};
  Object.assign(process.env,{NODE_ENV:"production",ALLOW_ANONYMOUS_AI:"true"});
  try { await assert.rejects(charge(new Request("http://localhost/api/edit"),1,async()=>{throw new Error("must not run");}),(e:Error & {status:number})=>e.status===401); }
  finally { if(previous.node===undefined) Reflect.deleteProperty(process.env,"NODE_ENV"); else Object.assign(process.env,{NODE_ENV:previous.node}); if(previous.anonymous===undefined) delete process.env.ALLOW_ANONYMOUS_AI; else process.env.ALLOW_ANONYMOUS_AI=previous.anonymous; }
});
