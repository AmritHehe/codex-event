import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { FREE_CREDITS, brief, connection, type AgentEvent, type workspace } from "@/lib/agent-contracts";
import { aspectSchema, sceneSchema, themeSchema, type Scene, type Theme } from "@/video/schema";

/** Thrown for expected failures; `status` maps to HTTP and the message is safe to show. */
export class WorkspaceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const assetSchema = z.object({
  id: z.string(),
  kind: z.enum(["meme", "screenshot", "logo"]),
  caption: z.string().optional(),
  url: z.string().optional(), // remote https asset
  file: z.string().optional(), // stored file name under the workspace assets dir
  type: z.enum(["image/png", "image/jpeg"]).optional(),
  createdAt: z.string(),
});
const draftSchema = z.object({ channelId: z.string(), text: z.string(), hashtags: z.array(z.string()).optional(), updatedAt: z.string() });
const projectRecord = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  aspect: aspectSchema,
  theme: themeSchema,
  scenes: z.array(sceneSchema),
  status: z.enum(["building", "ready"]),
  assets: z.array(assetSchema),
  drafts: z.array(draftSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const record = z.object({
  id: z.string(),
  tokenHash: z.string(),
  createdAt: z.string(),
  credits: z.number().int().min(0),
  connections: z.array(connection),
  brief: brief.nullable(),
  projects: z.array(projectRecord),
});

export type WorkspaceView = z.infer<typeof workspace>;
export type ProjectRecord = z.infer<typeof projectRecord>;
export type Asset = z.infer<typeof assetSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type NewProject = { name: string; url: string; aspect: z.infer<typeof aspectSchema>; theme: Theme };
export type NewAsset = { kind: Asset["kind"]; caption?: string } & ({ url: string } | { bytes: Buffer; type: "image/png" | "image/jpeg" });
type Listener = (event: AgentEvent) => void;

/**
 * Everything the web app, the MCP server and Phase 11 code need from a workspace. The file store below is
 * for dev and single-instance deploys; an Upstash Redis implementation can replace it behind this interface.
 */
export interface WorkspaceStore {
  create(): Promise<{ workspace: WorkspaceView; token: string }>;
  /** Issue a new token for an existing workspace (the old one stops working). */
  rotateToken(workspaceId: string): Promise<string>;
  /** Workspace id for a bearer/cookie token, or null. Constant-time hash comparison. */
  findByToken(token: string): Promise<string | null>;
  get(workspaceId: string): Promise<WorkspaceView | null>;
  setBrief(workspaceId: string, input: { url: string; notes?: string }): Promise<WorkspaceView>;
  /** Upsert a connected agent client; returns true when this client was not connected before. */
  recordConnection(workspaceId: string, client: string, version?: string): Promise<boolean>;
  /** Debit credits; throws WorkspaceError(402) when the balance is too low. Returns the remaining balance. */
  spendCredits(workspaceId: string, amount: number): Promise<number>;
  addCredits(workspaceId: string, amount: number): Promise<number>;
  createProject(workspaceId: string, input: NewProject): Promise<ProjectRecord>;
  getProject(workspaceId: string, projectId: string): Promise<ProjectRecord | null>;
  /** Atomically change a project; the callback may throw WorkspaceError to abort without writing. */
  updateProject<T>(workspaceId: string, projectId: string, change: (project: ProjectRecord) => T): Promise<T>;
  saveAsset(workspaceId: string, projectId: string, asset: NewAsset): Promise<Asset>;
  /** Stored bytes for a dataUrl asset, or the remote URL. Only within the owning workspace. */
  readAsset(workspaceId: string, assetId: string): Promise<{ url: string } | { bytes: Buffer; type: string } | null>;
  saveDrafts(workspaceId: string, projectId: string, posts: { channelId: string; text: string; hashtags?: string[] }[]): Promise<number>;
  publish(workspaceId: string, event: AgentEvent): void;
  subscribe(workspaceId: string, listener: Listener): () => void;
}

const ID = /^[a-f0-9]{24}$/;
const CHILD_ID = /^[pa]_[a-f0-9]{16}$/;
const MAX_PROJECTS = 50;
const MAX_ASSETS = 20;
const now = () => new Date().toISOString();
const hash = (token: string) => createHash("sha256").update(token).digest();
const newToken = (id: string) => `${id}.${randomBytes(32).toString("base64url")}`;

// ponytail: in-memory pub/sub only reaches SSE clients on the same server instance; use Redis pub/sub when deploying >1 instance.
const bus: Map<string, Set<Listener>> = ((globalThis as { __shipcastBus?: Map<string, Set<Listener>> }).__shipcastBus ??= new Map());

export function toView(r: z.infer<typeof record>): WorkspaceView {
  return {
    id: r.id,
    credits: r.credits,
    connections: r.connections,
    brief: r.brief,
    projects: r.projects.map((p) => ({ id: p.id, name: p.name, status: p.status, scenes: p.scenes.length, updatedAt: p.updatedAt })),
  };
}

export class FileWorkspaceStore implements WorkspaceStore {
  constructor(private dir = resolve(/*turbopackIgnore: true*/ process.env.WORKSPACE_DATA_DIR ?? ".data/workspaces")) {}

  private path(id: string, ...rest: string[]) {
    if (!ID.test(id)) throw new WorkspaceError(404, "Workspace not found.");
    return join(this.dir, id, ...rest);
  }

  private async read(id: string) {
    try {
      return record.parse(JSON.parse(await readFile(this.path(id, "workspace.json"), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof WorkspaceError) return null;
      throw new WorkspaceError(503, "Workspace data is unavailable. Check the server data directory.");
    }
  }

  private async write(id: string, data: z.infer<typeof record>) {
    const temporary = this.path(id, `workspace.${randomBytes(4).toString("hex")}.tmp`);
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, this.path(id, "workspace.json"));
  }

  /** Per-workspace mkdir lock + atomic rename, same pattern as the publication ledger. */
  private async transaction<T>(id: string, change: (data: z.infer<typeof record>) => T | Promise<T>): Promise<T> {
    const lock = this.path(id, "lock");
    let acquired = false;
    for (let i = 0; i < 300; i++) {
      try { await mkdir(lock); acquired = true; break; }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") throw new WorkspaceError(404, "Workspace not found.");
        if (code !== "EEXIST") throw error;
        const info = await stat(lock).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 30_000) await rm(lock, { recursive: true, force: true });
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    if (!acquired) throw new WorkspaceError(503, "Workspace is busy. Try again shortly.");
    try {
      const data = await this.read(id);
      if (!data) throw new WorkspaceError(404, "Workspace not found.");
      const result = await change(data);
      await this.write(id, record.parse(data));
      return result;
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }

  private project(data: z.infer<typeof record>, projectId: string) {
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new WorkspaceError(404, `Project ${projectId} not found. Use the projectId returned by create_project.`);
    return project;
  }

  async create() {
    const id = randomBytes(12).toString("hex");
    const token = newToken(id);
    await mkdir(this.path(id, "assets"), { recursive: true });
    const data = { id, tokenHash: hash(token).toString("hex"), createdAt: now(), credits: FREE_CREDITS, connections: [], brief: null, projects: [] };
    await this.write(id, data);
    return { workspace: toView(data), token };
  }

  rotateToken(workspaceId: string) {
    return this.transaction(workspaceId, (data) => {
      const token = newToken(workspaceId);
      data.tokenHash = hash(token).toString("hex");
      return token;
    });
  }

  async findByToken(token: string) {
    const id = token.split(".")[0];
    if (!ID.test(id) || token.length > 200) return null;
    const data = await this.read(id);
    const expected = data ? Buffer.from(data.tokenHash, "hex") : Buffer.alloc(32);
    const match = timingSafeEqual(hash(token), expected.length === 32 ? expected : Buffer.alloc(32));
    return data && match ? id : null;
  }

  async get(workspaceId: string) {
    const data = await this.read(workspaceId);
    return data && toView(data);
  }

  setBrief(workspaceId: string, input: { url: string; notes?: string }) {
    return this.transaction(workspaceId, (data) => {
      data.brief = { url: input.url, ...(input.notes ? { notes: input.notes } : {}), createdAt: now() };
      return toView(data);
    });
  }

  recordConnection(workspaceId: string, client: string, version?: string) {
    return this.transaction(workspaceId, (data) => {
      const existing = data.connections.find((c) => c.client === client);
      const entry = { client, ...(version ? { version } : {}), lastSeen: now() };
      if (existing) Object.assign(existing, entry);
      else data.connections = [...data.connections, entry].slice(-10);
      return !existing;
    });
  }

  spendCredits(workspaceId: string, amount: number) {
    return this.transaction(workspaceId, (data) => {
      if (!Number.isInteger(amount) || amount < 0) throw new WorkspaceError(400, "Invalid credit amount.");
      if (data.credits < amount) {
        throw new WorkspaceError(402, `Not enough credits: this needs ${amount} and you have ${data.credits}. Connect your own agent (Claude Code, Codex or Gemini CLI) on /connect to keep going for free.`);
      }
      data.credits -= amount;
      return data.credits;
    });
  }

  addCredits(workspaceId: string, amount: number) {
    return this.transaction(workspaceId, (data) => {
      if (!Number.isInteger(amount) || amount < 0) throw new WorkspaceError(400, "Invalid credit amount.");
      data.credits += amount;
      return data.credits;
    });
  }

  createProject(workspaceId: string, input: NewProject) {
    return this.transaction(workspaceId, (data) => {
      if (data.projects.length >= MAX_PROJECTS) throw new WorkspaceError(409, `A workspace holds at most ${MAX_PROJECTS} projects.`);
      const at = now();
      const project: ProjectRecord = { id: `p_${randomBytes(8).toString("hex")}`, ...input, scenes: [], status: "building", assets: [], drafts: [], createdAt: at, updatedAt: at };
      data.projects.push(project);
      return project;
    });
  }

  async getProject(workspaceId: string, projectId: string) {
    const data = await this.read(workspaceId);
    return data?.projects.find((p) => p.id === projectId) ?? null;
  }

  updateProject<T>(workspaceId: string, projectId: string, change: (project: ProjectRecord) => T) {
    return this.transaction(workspaceId, (data) => {
      const project = this.project(data, projectId);
      const result = change(project);
      project.updatedAt = now();
      return result;
    });
  }

  saveAsset(workspaceId: string, projectId: string, input: NewAsset) {
    return this.transaction(workspaceId, async (data) => {
      const project = this.project(data, projectId);
      if (project.assets.length >= MAX_ASSETS) throw new WorkspaceError(409, `A project holds at most ${MAX_ASSETS} assets.`);
      const asset: Asset = { id: `a_${randomBytes(8).toString("hex")}`, kind: input.kind, ...(input.caption ? { caption: input.caption } : {}), createdAt: now() };
      if ("url" in input) asset.url = input.url;
      else {
        // File name is built only from the server-generated id, never from client input.
        asset.file = `${asset.id}.${input.type === "image/png" ? "png" : "jpg"}`;
        asset.type = input.type;
        await mkdir(this.path(workspaceId, "assets"), { recursive: true });
        const temporary = this.path(workspaceId, "assets", `${asset.file}.tmp`);
        await writeFile(temporary, input.bytes, { mode: 0o600 });
        await rename(temporary, this.path(workspaceId, "assets", asset.file));
      }
      project.assets.push(asset);
      project.updatedAt = now();
      return asset;
    });
  }

  async readAsset(workspaceId: string, assetId: string) {
    if (!CHILD_ID.test(assetId)) return null;
    const data = await this.read(workspaceId);
    const asset = data?.projects.flatMap((p) => p.assets).find((a) => a.id === assetId);
    if (!asset) return null;
    if (asset.url) return { url: asset.url };
    return { bytes: await readFile(this.path(workspaceId, "assets", asset.file!)), type: asset.type! };
  }

  saveDrafts(workspaceId: string, projectId: string, posts: { channelId: string; text: string; hashtags?: string[] }[]) {
    return this.updateProject(workspaceId, projectId, (project) => {
      const at = now();
      for (const post of posts) {
        project.drafts = [...project.drafts.filter((d) => d.channelId !== post.channelId), { ...post, updatedAt: at }];
      }
      return posts.length;
    });
  }

  publish(workspaceId: string, event: AgentEvent) {
    for (const listener of bus.get(workspaceId) ?? []) {
      try { listener(event); } catch { /* a broken subscriber must not break the publisher */ }
    }
  }

  subscribe(workspaceId: string, listener: Listener) {
    const set = bus.get(workspaceId) ?? new Set();
    set.add(listener);
    bus.set(workspaceId, set);
    return () => {
      set.delete(listener);
      if (!set.size) bus.delete(workspaceId);
    };
  }
}

let instance: WorkspaceStore | undefined;
/** The process-wide store (lazy so tests can point WORKSPACE_DATA_DIR at a temp dir first). */
export const workspaces = () => (instance ??= new FileWorkspaceStore());

/** Scenes and theme as the video engine expects them, for project responses. */
export const toProject = (p: ProjectRecord): { id: string; name: string; aspect: ProjectRecord["aspect"]; theme: Theme; scenes: Scene[] } =>
  ({ id: p.id, name: p.name, aspect: p.aspect, theme: p.theme, scenes: p.scenes });
