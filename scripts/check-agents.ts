import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { agentEvent, createWorkspaceResponse, mcpTools, projectResponse, workspace, type AgentEvent } from "../src/lib/agent-contracts";
import { sampleProject } from "../src/video/sample";

import * as projectRoute from "../src/app/api/projects/[id]/route";
import * as generateRoute from "../src/app/api/generate/route";
import * as kitRoute from "../src/app/api/kit/route";
import * as briefRoute from "../src/app/api/workspace/brief/route";
import * as eventsRoute from "../src/app/api/workspace/events/route";
import * as workspaceRoute from "../src/app/api/workspace/route";
import * as mcpRoute from "../src/app/mcp/route";
import * as libraryRoute from "../src/app/api/workspace/library/route";
import * as assetRoute from "../src/app/api/workspace/assets/[id]/route";
import { libraryResponse } from "../src/lib/library-contracts";
import { ApiError } from "../src/server/http";
import { providers } from "../src/server/providers";
import { parseScrape } from "../src/server/scrape";
import { FileWorkspaceStore, WorkspaceError, workspaces } from "../src/server/workspace/store";

// The process-wide store is created lazily, so pointing it at a throwaway directory here is early enough.
const dataDir = mkdtempSync(join(tmpdir(), "shipcast-agents-"));
process.env.WORKSPACE_DATA_DIR = dataDir;
process.env.RESEARCH_DATA_DIR = join(dataDir, "research");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const busSize = (id: string) => (globalThis as { __shipcastBus?: Map<string, Set<unknown>> }).__shipcastBus?.get(id)?.size ?? 0;
async function* readChunks(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    yield value;
  }
}
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];

// ---------- a real HTTP server in front of the real Next route handlers ----------
let server: Server;
let origin: string;
async function dispatch(request: Request, path: string) {
  const project = /^\/api\/projects\/([^/]+)$/.exec(path);
  if (project) return projectRoute[request.method === "PUT" ? "PUT" : "GET"](request, { params: Promise.resolve({ id: decodeURIComponent(project[1]) }) });
  const routes: Record<string, Record<string, ((r: Request, c: never) => Promise<Response>) | undefined>> = {
    "/mcp": mcpRoute as never,
    "/api/workspace": workspaceRoute as never,
    "/api/workspace/brief": briefRoute as never,
    "/api/workspace/events": eventsRoute as never,
  };
  const handler = routes[path]?.[request.method];
  return handler ? handler(request, { params: Promise.resolve({}) } as never) : new Response("not found", { status: 404 });
}
before(async () => {
  server = createServer(async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const url = new URL(req.url!, origin);
    const headers = Object.entries(req.headers).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(", ") : v] as [string, string]]));
    const request = new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method!) ? undefined : Buffer.concat(chunks), signal: abort.signal });
    const response = await dispatch(request, url.pathname);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.flushHeaders();
    try { if (response.body) for await (const chunk of readChunks(response.body)) res.write(chunk); } catch { /* client went away */ }
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await rm(dataDir, { recursive: true, force: true });
});

/** Subscribe to the SSE endpoint and collect parsed `agentEvent`s. */
async function listen(cookie: string) {
  const abort = new AbortController();
  const response = await fetch(`${origin}/api/workspace/events`, { headers: { cookie }, signal: abort.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/event-stream/);
  const events: AgentEvent[] = [];
  const comments: string[] = [];
  const done = (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of readChunks(response.body!)) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (frame.startsWith(":")) comments.push(frame);
          else if (frame.startsWith("data: ")) events.push(agentEvent.parse(JSON.parse(frame.slice(6))));
        }
      }
    } catch { /* aborted */ }
  })();
  const until = async (predicate: (e: AgentEvent[]) => boolean) => {
    for (let i = 0; i < 200 && !predicate(events); i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(predicate(events), `events: ${JSON.stringify(events)}`);
  };
  return { events, comments, until, close: async () => { abort.abort(); await done; } };
}

async function newWorkspace() {
  const response = await fetch(`${origin}/api/workspace`, { method: "POST" });
  assert.equal(response.status, 201);
  const body = createWorkspaceResponse.parse(await response.json());
  return { ...body, cookie: cookieOf(response), response };
}

// ---------- store ----------
test("store hashes tokens at rest and finds workspaces only by the exact token", async () => {
  const store = new FileWorkspaceStore(join(dataDir, "unit"));
  const { workspace: ws, token } = await store.create();
  assert.ok(token.length >= 32);
  assert.equal(ws.credits, 20);
  const file = await readFile(join(dataDir, "unit", ws.id, "workspace.json"), "utf8");
  const secret = token.split(".")[1];
  assert.ok(!file.includes(secret), "raw token must never be stored");
  assert.equal(JSON.parse(file).tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(await store.findByToken(token), ws.id);
  for (const bad of ["", token + "x", `${ws.id}.${"A".repeat(43)}`, token.replace(ws.id, "0".repeat(24)), `../../etc.${secret}`, "x".repeat(500)]) {
    assert.equal(await store.findByToken(bad), null, bad);
  }
  const rotated = await store.rotateToken(ws.id);
  assert.equal(await store.findByToken(token), null);
  assert.equal(await store.findByToken(rotated), ws.id);
  assert.equal(await store.getProject(ws.id, "../../x"), null);
  assert.equal(await store.readAsset(ws.id, "../workspace.json"), null);
  assert.equal(await store.get("../unit"), null);
});

test("store writes atomically under concurrency and credits never go negative", async () => {
  const store = new FileWorkspaceStore(join(dataDir, "unit"));
  const { workspace: ws } = await store.create();
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => store.spendCredits(ws.id, 1)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 20);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason instanceof WorkspaceError && r.reason.status === 402));
  assert.equal((await store.get(ws.id))!.credits, 0);
  await assert.rejects(store.spendCredits(ws.id, 1), /Not enough credits/);
  await Promise.all([store.addCredits(ws.id, 3), store.recordConnection(ws.id, "a"), store.setBrief(ws.id, { url: "https://example.com" })]);
  const after = (await store.get(ws.id))!;
  assert.deepEqual([after.credits, after.connections.length, after.brief?.url], [3, 1, "https://example.com"]);
  assert.deepEqual((await readdir(join(dataDir, "unit", ws.id))).sort(), ["assets", "workspace.json"], "no temp files or locks left behind");
});

// ---------- web API ----------
test("workspace API: cookie flow, token once, brief, 401s", async () => {
  const { workspace: ws, token, cookie, response } = await newWorkspace();
  const setCookie = response.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.doesNotMatch(setCookie, /Secure/, "Secure only in production");
  assert.equal(cookie, `shipcast_ws=${token}`);
  assert.equal((await fetch(`${origin}/api/workspace`)).status, 401);
  assert.equal((await fetch(`${origin}/api/workspace`, { headers: { cookie: "shipcast_ws=forged.token" } })).status, 401);
  const current = workspace.parse(await (await fetch(`${origin}/api/workspace`, { headers: { cookie } })).json());
  assert.deepEqual(current, ws);
  const json = { "content-type": "application/json" };
  assert.equal((await fetch(`${origin}/api/workspace/brief`, { method: "POST", headers: json, body: JSON.stringify({ url: "https://example.com" }) })).status, 401);
  assert.equal((await fetch(`${origin}/api/workspace/brief`, { method: "POST", headers: { ...json, cookie }, body: JSON.stringify({ url: "nope" }) })).status, 400);
  const saved = await fetch(`${origin}/api/workspace/brief`, { method: "POST", headers: { ...json, cookie }, body: JSON.stringify({ url: "https://acme.dev", notes: "Dev tool" }) });
  assert.equal(saved.status, 200);
  assert.equal(workspace.parse(await saved.json()).brief?.notes, "Dev tool");
  assert.equal((await fetch(`${origin}/api/workspace/events`)).status, 401);
  assert.equal((await fetch(`${origin}/api/projects/p_0000000000000000`)).status, 401);
  // POST again with a valid cookie keeps the workspace and rotates the token.
  const again = await fetch(`${origin}/api/workspace`, { method: "POST", headers: { cookie } });
  const rotated = createWorkspaceResponse.parse(await again.json());
  assert.equal(rotated.workspace.id, ws.id);
  assert.notEqual(rotated.token, token);
  assert.equal((await fetch(`${origin}/api/workspace`, { headers: { cookie } })).status, 401, "old token no longer works");
});

test("SSE streams events, heartbeats and unsubscribes on disconnect", async () => {
  const { workspace: ws, cookie } = await newWorkspace();
  const stream = await listen(cookie);
  await stream.until(() => busSize(ws.id) === 1);
  workspaces().publish(ws.id, { type: "credits", remaining: 7 });
  await stream.until((e) => e.some((x) => x.type === "credits"));
  assert.deepEqual(stream.events, [{ type: "credits", remaining: 7 }]);
  assert.ok(stream.comments.includes(": connected"));
  await stream.close();
  for (let i = 0; i < 100 && busSize(ws.id); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(busSize(ws.id), 0, "listener removed after client disconnects");
});

// ---------- credits ----------
test("credits: kit and generate bill the cookie workspace only on success; anonymous calls stay free", async () => {
  const original = { ...providers };
  const key = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "test-only";
  const page = parseScrape({ success: true, data: { markdown: "# Acme", screenshot: "https://cdn.example.com/p.png", metadata: { ogSiteName: "Acme" }, branding: { colors: { primary: "#ff4f17" } } } }, "https://example.com/");
  const stub = (result: unknown, fail = false) => Object.assign(providers, {
    scrapeProduct: async () => page,
    exa: async () => { throw new Error("no Exa in tests"); },
    structured: async (schema: { parse: (v: unknown) => unknown }) => { if (fail) throw new Error("provider down"); return schema.parse(result); },
  });
  try {
    const film = { direction: { angle: "a", hook: "h", proofPoints: [], visualConcept: "v" }, project: sampleProject };
    const { workspace: ws, cookie } = await newWorkspace();
    const stream = await listen(cookie);
    const post = (route: { POST: (r: Request) => Promise<Response> }, body: unknown, withCookie = true) =>
      route.POST(new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json", ...(withCookie ? { cookie } : {}) }, body: JSON.stringify(body) }));
    const credits = async () => (await workspaces().get(ws.id))!.credits;

    stub({ posts: [{ channelId: "x", text: "Ship loud" }, { channelId: "linkedin-personal", text: "We built it" }] });
    assert.equal((await post(kitRoute, { project: sampleProject, channels: ["x", "linkedin-personal"] })).status, 200);
    assert.equal(await credits(), 18);
    stub(film);
    assert.equal((await post(generateRoute, { url: "https://example.com" })).status, 200);
    assert.equal(await credits(), 16);
    assert.equal((await post(generateRoute, { url: "https://example.com" }, false)).status, 200, "anonymous still works");
    assert.equal(await credits(), 16);
    stub(film, true);
    assert.equal((await post(generateRoute, { url: "https://example.com" })).status, 502);
    assert.equal(await credits(), 16, "failed work is refunded");
    assert.equal((await post(generateRoute, { url: "bad" })).status, 400);
    assert.equal(await credits(), 16, "invalid input is never billed");

    await workspaces().spendCredits(ws.id, 15);
    stub(film);
    const broke = await post(generateRoute, { url: "https://example.com" });
    assert.equal(broke.status, 402);
    assert.match((await broke.json()).error, /Not enough credits: this needs 2 and you have 1/);
    assert.equal(await credits(), 1);
    await stream.until((e) => e.filter((x) => x.type === "credits").length === 2);
    assert.deepEqual(stream.events.filter((x) => x.type === "credits"), [{ type: "credits", remaining: 18 }, { type: "credits", remaining: 16 }]);
    await stream.close();
  } finally {
    Object.assign(providers, original);
    if (key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = key;
  }
});

// ---------- MCP end to end ----------
const text = (result: unknown) => ((result as { content: { text: string }[] }).content[0].text);
const data = (result: unknown) => {
  assert.ok(!(result as { isError?: boolean }).isError, text(result));
  return JSON.parse(text(result));
};
const errorText = (result: unknown) => {
  assert.equal((result as { isError?: boolean }).isError, true, text(result));
  return text(result);
};

test("MCP rejects missing and invalid tokens with a helpful 401", async () => {
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } };
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  const missing = await fetch(`${origin}/mcp`, { method: "POST", headers, body: JSON.stringify(init) });
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get("www-authenticate")!, /^Bearer /);
  assert.match((await missing.json()).error.message, /Missing Shipcast workspace token.*\/connect.*Authorization: Bearer/);
  const invalid = await fetch(`${origin}/mcp`, { method: "POST", headers: { ...headers, authorization: "Bearer abc.def" }, body: JSON.stringify(init) });
  assert.equal(invalid.status, 401);
  assert.match((await invalid.json()).error.message, /not valid/);
});

test("end to end: an agent builds a film over MCP while the web app watches", async () => {
  const { workspace: ws, token, cookie } = await newWorkspace();
  const json = { "content-type": "application/json", cookie };
  await fetch(`${origin}/api/workspace/brief`, { method: "POST", headers: json, body: JSON.stringify({ url: "https://acme.dev", notes: "Launch Tuesday" }) });
  const stream = await listen(cookie);

  const client = new Client({ name: "check-agents", version: "1.2.3" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  await stream.until((e) => e.some((x) => x.type === "connected"));

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(mcpTools).sort());
  for (const tool of tools) assert.equal(tool.description, mcpTools[tool.name as keyof typeof mcpTools].description);
  assert.ok((tools.find((t) => t.name === "put_scene")!.inputSchema.required as string[]).includes("scene"));
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name), ["launch"]);
  const prompt = await client.getPrompt({ name: "launch" });
  assert.match((prompt.messages[0].content as { text: string }).text, /^# Build a Shipcast launch film/);

  assert.deepEqual(data(await client.callTool({ name: "get_brief", arguments: {} })), { url: "https://acme.dev", notes: "Launch Tuesday", createdAt: (await workspaces().get(ws.id))!.brief!.createdAt });
  const guide = data(await client.callTool({ name: "get_guide", arguments: {} }));
  assert.ok(guide.schema.properties.scenes);
  assert.match(guide.rules, /## Workflow/);
  assert.equal(guide.example.id, "sample");

  const created = data(await client.callTool({ name: "create_project", arguments: { name: "Acme launch", url: "https://acme.dev", theme: sampleProject.theme } }));
  const projectId: string = created.projectId;
  assert.equal(created.studioUrl, `${origin}/studio?live=${projectId}`);
  assert.match(errorText(await client.callTool({ name: "finish_project", arguments: { projectId } })), /no scenes yet/);

  const [hook, problem, product] = sampleProject.scenes;
  const invalid = errorText(await client.callTool({ name: "put_scene", arguments: { projectId, scene: { ...hook, durationInFrames: 5 } } }));
  assert.match(invalid, /scene\.durationInFrames: Too small/);
  for (const scene of [hook, problem, product]) data(await client.callTool({ name: "put_scene", arguments: { projectId, scene } }));
  // Upsert by id keeps one copy and can move it.
  assert.equal(data(await client.callTool({ name: "put_scene", arguments: { projectId, scene: { ...problem, name: "Problem v2" }, index: 1 } })).scenes, 3);
  assert.match(errorText(await client.callTool({ name: "put_scene", arguments: { projectId: "p_0000000000000000", scene: hook } })), /Project p_0000000000000000 not found/);
  data(await client.callTool({ name: "set_theme", arguments: { projectId, theme: { ...sampleProject.theme, accent: "#FF4F17" } } }));
  const finished = data(await client.callTool({ name: "finish_project", arguments: { projectId } }));
  assert.equal(finished.studioUrl, created.studioUrl);
  const read = data(await client.callTool({ name: "get_project", arguments: { projectId } }));
  assert.deepEqual(read.project.scenes.map((s: { id: string }) => s.id), [hook.id, problem.id, product.id]);
  assert.equal(read.project.scenes[1].name, "Problem v2");
  assert.equal(read.status, "ready");

  const asset = data(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "meme", dataUrl: PNG, caption: "When the launch video takes a week" } }));
  const stored = await workspaces().readAsset(ws.id, asset.assetId);
  assert.ok(stored && "bytes" in stored && stored.type === "image/png" && stored.bytes.subarray(1, 4).toString() === "PNG");
  data(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "logo", url: "https://acme.dev/logo.png" } }));
  assert.match(errorText(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "meme", dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" } })), /image\/png/);
  assert.match(errorText(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "meme", dataUrl: "data:image/png;base64,/9j/4AAQSkZJRg==" } })), /not a valid PNG/);
  assert.match(errorText(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "meme", url: "http://insecure.dev/a.png" } })), /https/);
  assert.match(errorText(await client.callTool({ name: "save_asset", arguments: { projectId, kind: "meme", url: "https://a.dev/a.png", dataUrl: PNG } })), /exactly one of url or dataUrl/);

  assert.equal(data(await client.callTool({ name: "draft_posts", arguments: { projectId, posts: [{ channelId: "x", text: "We built Acme" }, { channelId: "product-hunt", text: "Launch films from a URL" }] } })).saved, 2);
  assert.match(errorText(await client.callTool({ name: "draft_posts", arguments: { projectId, posts: [{ channelId: "myspace", text: "hi" }] } })), /Unknown channelId: myspace/);

  // The web app sees the same project; other workspaces cannot.
  const web = await fetch(`${origin}/api/projects/${projectId}`, { headers: { cookie } });
  assert.equal(web.status, 200);
  const body = projectResponse.parse(await web.json());
  assert.equal(body.status, "ready");
  assert.equal(body.project.theme.accent, "#FF4F17");
  assert.equal(body.project.scenes.length, 3);
  const other = await newWorkspace();
  assert.equal((await fetch(`${origin}/api/projects/${projectId}`, { headers: { cookie: other.cookie } })).status, 404);
  const otherClient = new Client({ name: "intruder", version: "1" });
  await otherClient.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${other.token}` } } }));
  assert.match(errorText(await otherClient.callTool({ name: "get_project", arguments: { projectId } })), /not found/);
  await otherClient.close();

  const state = workspace.parse(await (await fetch(`${origin}/api/workspace`, { headers: { cookie } })).json());
  assert.deepEqual(state.connections.map((c) => [c.client, c.version]), [["check-agents", "1.2.3"]]);
  assert.deepEqual(state.projects.map((p) => [p.id, p.status, p.scenes]), [[projectId, "ready", 3]]);

  await stream.until((e) => e.some((x) => x.type === "posts.drafted"));
  const events = stream.events;
  assert.deepEqual(events[0], { type: "connected", client: "check-agents", version: "1.2.3" });
  const specific = events.filter((e) => e.type !== "tool" && e.type !== "connected");
  assert.deepEqual(specific, [
    { type: "project.created", projectId, name: "Acme launch" },
    { type: "scene.upserted", projectId, sceneId: hook.id, index: 0 },
    { type: "scene.upserted", projectId, sceneId: problem.id, index: 1 },
    { type: "scene.upserted", projectId, sceneId: product.id, index: 2 },
    { type: "scene.upserted", projectId, sceneId: problem.id, index: 1 },
    { type: "theme.set", projectId },
    { type: "project.finished", projectId },
    { type: "asset.saved", projectId, assetId: asset.assetId, kind: "meme" },
    { type: "asset.saved", projectId, assetId: (await workspaces().getProject(ws.id, projectId))!.assets[1].id, kind: "logo" },
    { type: "posts.drafted", projectId, count: 2 },
  ]);
  const tools_ = events.filter((e) => e.type === "tool").map((e) => (e as { name: string }).name);
  assert.equal(tools_.filter((n) => n === "put_scene").length, 6, "every call is reported, including failed ones");
  assert.ok(["get_brief", "get_guide", "create_project", "set_theme", "finish_project", "get_project", "save_asset", "draft_posts"].every((n) => tools_.includes(n)));
  assert.ok(!events.some((e) => e.type === "connected" && e.client === "intruder"), "events stay inside their workspace");

  await client.close();
  await stream.close();
});

test("Studio edits PUT back to the project are what the agent's get_project returns", async () => {
  const { token, cookie } = await newWorkspace();
  const client = new Client({ name: "check-agents", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const { projectId } = data(await client.callTool({ name: "create_project", arguments: { name: "Acme", url: "https://acme.dev", theme: sampleProject.theme } }));
  const put = (c: string, body: unknown) => fetch(`${origin}/api/projects/${projectId}`, { method: "PUT", headers: { "content-type": "application/json", cookie: c }, body: JSON.stringify(body) });
  const edited = { ...sampleProject, id: projectId, name: "Edited by hand" };
  assert.equal((await put(cookie, { project: edited })).status, 200);
  assert.equal(data(await client.callTool({ name: "get_project", arguments: { projectId } })).project.name, "Edited by hand");
  assert.equal((await put(cookie, { project: { ...edited, scenes: [] } })).status, 400);
  assert.equal((await put((await newWorkspace()).cookie, { project: edited })).status, 404);
  await client.close();
});

test("2026-07-28 clients (per-request clientInfo envelope) are recorded as connections too", async () => {
  const { workspace: ws, token } = await newWorkspace();
  const client = new Client({ name: "modern-agent", version: "9.9" }, { versionNegotiation: { mode: "auto" } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  assert.equal(data(await client.callTool({ name: "get_brief", arguments: {} })).url, null);
  assert.deepEqual((await workspaces().get(ws.id))!.connections.map((c) => c.client), ["modern-agent"]);
  await client.close();
});

test("MCP research_product bills 1 credit, refunds failures, and get_brief carries the cached brief", async () => {
  const original = { ...providers };
  const key = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "test-only";
  const { workspace: ws, token, cookie } = await newWorkspace();
  const url = "https://acme-research.dev/";
  await fetch(`${origin}/api/workspace/brief`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ url }) });
  const client = new Client({ name: "researcher", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const credits = async () => (await workspaces().get(ws.id))!.credits;
  const research = (target: string) => client.callTool({ name: "research_product", arguments: { url: target } });
  try {
    assert.equal(data(await client.callTool({ name: "get_brief", arguments: {} })).research, undefined);
    Object.assign(providers, { exa: async () => { throw new ApiError(502, "Product research failed. Check Exa credits and try again."); } });
    assert.match(errorText(await research(url)), /Product research failed/);
    assert.match(errorText(await research("http://localhost:3000")), /public http/);
    assert.equal(await credits(), 20, "failures are refunded");

    Object.assign(providers, {
      exa: async (path: string) => ({ results: path === "/contents" ? [{ url, title: "Acme", text: "Acme turns URLs into launch films." }] : [] }),
      structured: async (schema: { parse: (v: unknown) => unknown }) => schema.parse({
        product: { name: "Acme", oneLiner: "Launch films from a URL", category: "Video", audience: "Founders", problem: "Videos take a week", sourceUrl: url },
        features: [], proof: [], mentionUrls: [], competitors: [], voice: { adjectives: ["direct"], sampleLines: [] },
      }),
    });
    const brief = data(await research(url));
    assert.equal(brief.product.name, "Acme");
    assert.equal(await credits(), 19);
    assert.equal(data(await client.callTool({ name: "get_brief", arguments: {} })).research.product.name, "Acme");
  } finally {
    Object.assign(providers, original);
    if (key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = key;
    await client.close();
  }
});

// ---------- dashboard library ----------
test("library lists projects newest first with drafts and asset urls; asset bytes only for the owner", async () => {
  const store = workspaces();
  const { workspace: ws, token } = await store.create();
  const cookie = `shipcast_ws=${token}`;
  const get = (path: string, c?: string) => new Request(`http://local${path}`, { headers: c ? { cookie: c } : {} });
  const assetGet = (id: string, c?: string) => assetRoute.GET(get(`/api/workspace/assets/${id}`, c), { params: Promise.resolve({ id }) });
  const bytes = Buffer.from(PNG.split(",")[1], "base64");
  const older = await store.createProject(ws.id, { name: "Old", url: "https://old.dev", aspect: sampleProject.aspect, theme: sampleProject.theme });
  await new Promise((r) => setTimeout(r, 5));
  const newer = await store.createProject(ws.id, { name: "New", url: "https://new.dev", aspect: sampleProject.aspect, theme: sampleProject.theme });
  const png = await store.saveAsset(ws.id, newer.id, { kind: "meme", caption: "hi", bytes, type: "image/png" });
  const remote = await store.saveAsset(ws.id, newer.id, { kind: "logo", url: "https://cdn.example.com/logo.png" });
  await store.saveDrafts(ws.id, newer.id, [{ channelId: "x", text: "Ship it", hashtags: ["#launch"] }]);

  assert.equal((await libraryRoute.GET(get("/api/workspace/library"), {} as never)).status, 401);
  const lib = libraryResponse.parse(await (await libraryRoute.GET(get("/api/workspace/library", cookie), {} as never)).json());
  assert.equal(lib.credits, 20);
  assert.deepEqual(lib.projects.map((p) => p.id), [newer.id, older.id]);
  assert.equal(lib.projects[0].url, "https://new.dev");
  assert.deepEqual(lib.projects[0].drafts, [{ channelId: "x", text: "Ship it", hashtags: ["#launch"] }]);
  assert.deepEqual(lib.projects[0].assets, [
    { id: png.id, kind: "meme", caption: "hi", url: `/api/workspace/assets/${png.id}` },
    { id: remote.id, kind: "logo", url: "https://cdn.example.com/logo.png" },
  ]);

  const served = await assetGet(png.id, cookie);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.equal(served.headers.get("cache-control"), "private, max-age=3600");
  assert.equal(served.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), bytes);

  const other = await store.create();
  assert.equal((await assetGet(png.id, `shipcast_ws=${other.token}`)).status, 404, "other workspaces cannot read it");
  assert.equal((await assetGet(png.id)).status, 401);
  for (const bad of ["../workspace.json", "a_xyz", remote.id]) assert.equal((await assetGet(bad, cookie)).status, 404, bad);
});
