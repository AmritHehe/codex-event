import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { CHANNELS } from "@/distribution/channels";
import { createProjectResult, mcpTools } from "@/lib/agent-contracts";
import { ApiError } from "@/server/http";
import { projectSchema } from "@/video/schema";
import { sampleProject } from "@/video/sample";
import { cachedResearch, research } from "@/server/research";
import { WorkspaceError, toProject, workspaces, type WorkspaceStore } from "@/server/workspace/store";

type Tools = typeof mcpTools;
type ToolName = keyof Tools;
type Ctx = { workspaceId: string; origin: string; store: WorkspaceStore; signal: AbortSignal };
type Handlers = { [K in ToolName]: (input: z.output<Tools[K]["input"]>, ctx: Ctx) => Promise<unknown> };

const MAX_BODY_BYTES = 4_000_000; // save_asset dataUrl (2.8 MB of base64) plus JSON-RPC envelope
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_SCENES = 30;
const SKILL_PATH = join(process.cwd(), "plugin/skills/shipcast-launch/SKILL.md");

let skill: Promise<{ description: string; body: string }> | undefined;
/** SKILL.md is the single source of agent instructions; served by get_guide and the `launch` prompt. */
export const loadSkill = () => (skill ??= readFile(SKILL_PATH, "utf8").then((text) => {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return { description: /^description:\s*(.+)$/m.exec(front?.[1] ?? "")?.[1] ?? "Build a Shipcast launch film.", body: text.slice(front?.[0].length ?? 0).trim() };
}));

const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.length ? i.path.join(".") : "project"}: ${i.message}`).join("; ");
const studioUrl = (ctx: Ctx, projectId: string) => `${ctx.origin}/studio?live=${encodeURIComponent(projectId)}`;
const fail = (message: string) => { throw new WorkspaceError(400, message); };

function decodeImage(dataUrl: string) {
  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) fail("dataUrl must be data:image/png;base64,... or data:image/jpeg;base64,... Other formats are not accepted.");
  const [, type, base64] = match!;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_ASSET_BYTES) fail("Image is larger than 2 MB. Send a smaller image or a public https url.");
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if ((type === "image/png" && !png) || (type === "image/jpeg" && !jpeg)) fail(`dataUrl says ${type} but the bytes are not a valid ${type === "image/png" ? "PNG" : "JPEG"} image.`);
  return { bytes, type: type as "image/png" | "image/jpeg" };
}

const handlers: Handlers = {
  async get_brief(_input, { store, workspaceId }) {
    const ws = await store.get(workspaceId);
    if (!ws?.brief) return { url: null, message: "The user has not entered a product URL on Shipcast yet. Ask them for it." };
    const brief = await cachedResearch(ws.brief.url);
    return brief ? { ...ws.brief, research: brief } : ws.brief;
  },
  async research_product({ url }, { store, workspaceId, signal }) {
    // Server-paid (Exa + model), so it costs 1 credit: reserved first, refunded if research fails.
    const remaining = await store.spendCredits(workspaceId, 1);
    try {
      const brief = await research(url, signal);
      store.publish(workspaceId, { type: "credits", remaining });
      return brief;
    } catch (error) {
      await store.addCredits(workspaceId, 1);
      if (error instanceof ApiError) fail(error.message);
      throw error;
    }
  },
  async get_guide() {
    const { body } = await loadSkill();
    return { schema: z.toJSONSchema(projectSchema), rules: body, example: sampleProject };
  },
  async create_project(input, ctx) {
    const project = await ctx.store.createProject(ctx.workspaceId, input);
    ctx.store.publish(ctx.workspaceId, { type: "project.created", projectId: project.id, name: project.name });
    return createProjectResult.parse({ projectId: project.id, studioUrl: studioUrl(ctx, project.id) });
  },
  async put_scene({ projectId, scene, index }, { store, workspaceId }) {
    const at = await store.updateProject(workspaceId, projectId, (p) => {
      const existing = p.scenes.findIndex((s) => s.id === scene.id);
      if (existing < 0 && p.scenes.length >= MAX_SCENES) fail(`A film holds at most ${MAX_SCENES} scenes.`);
      if (existing >= 0) p.scenes.splice(existing, 1);
      const target = Math.min(index ?? (existing >= 0 ? existing : p.scenes.length), p.scenes.length);
      p.scenes.splice(target, 0, scene);
      p.status = "building";
      return { index: target, total: p.scenes.length };
    });
    store.publish(workspaceId, { type: "scene.upserted", projectId, sceneId: scene.id, index: at.index });
    return { ok: true, sceneId: scene.id, index: at.index, scenes: at.total };
  },
  async set_theme({ projectId, theme }, { store, workspaceId }) {
    await store.updateProject(workspaceId, projectId, (p) => { p.theme = theme; p.status = "building"; });
    store.publish(workspaceId, { type: "theme.set", projectId });
    return { ok: true };
  },
  async get_project({ projectId }, { store, workspaceId }) {
    const project = await store.getProject(workspaceId, projectId);
    if (!project) fail(`Project ${projectId} not found. Use the projectId returned by create_project.`);
    return { project: toProject(project!), status: project!.status };
  },
  async finish_project({ projectId }, ctx) {
    await ctx.store.updateProject(ctx.workspaceId, projectId, (p) => {
      if (!p.scenes.length) fail("The film has no scenes yet. Add scenes with put_scene, then call finish_project again.");
      const checked = projectSchema.safeParse(toProject(p));
      if (!checked.success) fail(`The film is not valid yet. Fix these and call finish_project again: ${issues(checked.error)}`);
      p.status = "ready";
    });
    ctx.store.publish(ctx.workspaceId, { type: "project.finished", projectId });
    return { ok: true, status: "ready", studioUrl: studioUrl(ctx, projectId) };
  },
  async save_asset({ projectId, kind, url, dataUrl, caption }, { store, workspaceId }) {
    const asset = await store.saveAsset(workspaceId, projectId, { kind, caption, ...(url ? { url } : decodeImage(dataUrl!)) });
    store.publish(workspaceId, { type: "asset.saved", projectId, assetId: asset.id, kind });
    return { ok: true, assetId: asset.id };
  },
  async draft_posts({ projectId, posts }, { store, workspaceId }) {
    const unknown = posts.map((p) => p.channelId).filter((id) => !CHANNELS.some((c) => c.id === id));
    if (unknown.length) fail(`Unknown channelId: ${[...new Set(unknown)].join(", ")}. Use catalog ids such as x, linkedin-personal, product-hunt.`);
    const count = await store.saveDrafts(workspaceId, projectId, posts);
    store.publish(workspaceId, { type: "posts.drafted", projectId, count });
    return { ok: true, saved: count, note: "Drafts only. Nothing was published." };
  },
};

const clientInfo = z.object({ name: z.string().min(1).max(100), version: z.string().max(50).optional() });
const toolNames = new Set<string>(Object.keys(mcpTools));

/** Record the agent client as a connection and emit live `connected` / `tool` events from the raw JSON-RPC body. */
async function observe(store: WorkspaceStore, workspaceId: string, body: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return; }
  for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
    const { method, params } = (message ?? {}) as { method?: unknown; params?: Record<string, unknown> };
    if (typeof method !== "string") continue;
    // 2025-era clients send clientInfo in initialize; 2026-07-28 clients send it in every request's _meta envelope.
    const info = clientInfo.safeParse(method === "initialize" ? params?.clientInfo : (params?._meta as Record<string, unknown> | undefined)?.["io.modelcontextprotocol/clientInfo"]);
    if (info.success) {
      const isNew = await store.recordConnection(workspaceId, info.data.name, info.data.version);
      if (isNew || method === "initialize" || method === "server/discover") {
        store.publish(workspaceId, { type: "connected", client: info.data.name, ...(info.data.version ? { version: info.data.version } : {}) });
      }
    }
    if (method === "tools/call" && typeof params?.name === "string" && toolNames.has(params.name)) {
      store.publish(workspaceId, { type: "tool", name: params.name });
    }
  }
}

function register(server: McpServer) {
  for (const name of Object.keys(mcpTools) as ToolName[]) {
    const tool = mcpTools[name];
    server.registerTool(name, { description: tool.description, inputSchema: tool.input as z.ZodObject }, async (input, extra) => {
      const ctx = extra.http?.authInfo?.extra as Omit<Ctx, "store" | "signal"> | undefined;
      if (!ctx?.workspaceId) throw new Error("Not authenticated.");
      try {
        const result = await (handlers[name] as (input: unknown, ctx: Ctx) => Promise<unknown>)(input, { ...ctx, store: workspaces(), signal: extra.mcpReq.signal });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        if (error instanceof WorkspaceError) throw new Error(error.message);
        console.error(`Shipcast MCP tool ${name} failed:`, error instanceof Error ? error.message : error);
        throw new Error("Shipcast could not complete this call. Try again.");
      }
    });
  }
  server.registerPrompt("launch", { description: "Build a Shipcast launch film for the product in the user's brief." }, async () => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text: (await loadSkill()).body } }],
  }));
}

const mcp = createMcpHandler(register, {
  serverInfo: { name: "shipcast", version: "1.0.0" },
  instructions: "Shipcast builds launch films. Run the `launch` prompt, or call get_brief then get_guide first. Every tool returns readable validation errors: fix exactly what they name and retry.",
});

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const rpcError = (status: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** Streamable HTTP MCP endpoint (public path MCP_PATH = /mcp) authenticated with the workspace token as a Bearer token. */
export function mcpRoute() {
  const store = workspaces;
  return async (request: Request) => {
    const origin = new URL(request.url).origin;
    const token = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    const workspaceId = token ? await store().findByToken(token) : null;
    if (!workspaceId) {
      const message = `${token ? "This Shipcast workspace token is not valid (it may have been replaced)." : "Missing Shipcast workspace token."} Open ${origin}/connect, copy the install command and add the server with the header "Authorization: Bearer <token>".`;
      return rpcError(401, message, { "WWW-Authenticate": `Bearer realm="shipcast", error="invalid_token", error_description="${token ? "invalid token" : "token required"}"` });
    }
    let body: string | undefined;
    if (request.method === "POST") {
      const read = await readBody(request);
      if (read === null) return rpcError(413, "Request is too large. Maximum is 4 MB; send images as a public https url or a dataUrl under 2 MB.");
      body = read;
      await observe(store(), workspaceId, body).catch(() => {}); // live activity must never block the agent
    }
    const forwarded = new Request(request.url, { method: request.method, headers: request.headers, body, signal: request.signal });
    forwarded.auth = { token: "workspace", clientId: workspaceId, scopes: [], extra: { workspaceId, origin } };
    return mcp(forwarded);
  };
}
