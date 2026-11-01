// Contract for "bring your own agent": the user's CLI agent (Codex, Claude Code, Gemini CLI) connects to our
// hosted MCP server and builds the film with the user's own subscription. The web app watches it happen.
// Backend implements: /mcp, /api/workspace*, /api/projects/:id. Frontend consumes. Change only in a small PR.
import { z } from "zod";
import { aspectSchema, projectSchema, sceneSchema, themeSchema } from "@/video/schema";

export const AGENT_CLIENTS = [
  { id: "codex", name: "Codex CLI", plan: "ChatGPT Plus or Pro", does: ["film", "copy", "memes"] },
  { id: "claude-code", name: "Claude Code", plan: "Claude Pro or Max", does: ["film", "copy"] },
  { id: "gemini-cli", name: "Gemini CLI", plan: "Google AI plan", does: ["film", "copy", "memes"] },
] as const;
export type AgentClientId = (typeof AGENT_CLIENTS)[number]["id"];

export const FREE_CREDITS = 20; // server-paid AI (humanised copy) for users without a connected agent
export const MCP_PATH = "/mcp";

const id = z.string().min(1).max(64);
const httpsUrl = z.string().url().refine((s) => new URL(s).protocol === "https:", "Use an https URL.");

// ---------- web: workspace ----------
// POST /api/workspace -> creates an anonymous workspace, sets an httpOnly cookie, returns the token ONCE.
// GET  /api/workspace -> current state (cookie auth).
export const brief = z.object({ url: z.string().url(), notes: z.string().max(500).optional(), createdAt: z.string().datetime() });
export const connection = z.object({ client: z.string(), version: z.string().optional(), lastSeen: z.string().datetime() });
export const projectSummary = z.object({ id, name: z.string(), status: z.enum(["building", "ready"]), scenes: z.number().int(), updatedAt: z.string().datetime() });
export const workspace = z.object({
  id,
  credits: z.number().int().min(0),
  connections: z.array(connection),
  brief: brief.nullable(),
  projects: z.array(projectSummary),
});
export const createWorkspaceResponse = z.object({ workspace, token: z.string().min(32) });

// POST /api/workspace/brief: what the agent should build next (read by the MCP tool get_brief).
export const briefRequest = z.object({ url: z.string().url(), notes: z.string().max(500).optional() });

// GET /api/projects/:id -> the project the agent is building (cookie auth, same workspace).
export const projectResponse = z.object({ project: projectSchema.partial({ scenes: true }).extend({ scenes: z.array(sceneSchema) }), status: projectSummary.shape.status });

// GET /api/workspace/events -> Server-Sent Events, one JSON `agentEvent` per `data:` line.
export const agentEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connected"), client: z.string(), version: z.string().optional() }),
  z.object({ type: z.literal("tool"), name: z.string() }), // any MCP tool call, for live activity
  z.object({ type: z.literal("project.created"), projectId: id, name: z.string() }),
  z.object({ type: z.literal("scene.upserted"), projectId: id, sceneId: id, index: z.number().int() }),
  z.object({ type: z.literal("theme.set"), projectId: id }),
  z.object({ type: z.literal("project.finished"), projectId: id }),
  z.object({ type: z.literal("asset.saved"), projectId: id, assetId: id, kind: z.enum(["meme", "screenshot", "logo"]) }),
  z.object({ type: z.literal("posts.drafted"), projectId: id, count: z.number().int() }),
  z.object({ type: z.literal("credits"), remaining: z.number().int() }),
]);
export type AgentEvent = z.infer<typeof agentEvent>;

// ---------- MCP tools (Streamable HTTP at MCP_PATH, `Authorization: Bearer <workspace token>`) ----------
// Every tool validates with these schemas and returns readable validation errors so the agent can fix and retry.
export const mcpTools = {
  get_brief: { description: "Product URL and notes the user entered on Shipcast. Call this first.", input: z.object({}) },
  research_product: {
    description: "Sourced research brief for a product URL: features, proof, competitors, third-party mentions, voice and visuals, each with its source URL. Costs 1 workspace credit (cached URLs too). Use only these facts in the film and copy.",
    input: z.object({ url: z.string().url() }),
  },
  get_guide: { description: "Exact JSON Schema for scenes, layers and themes, plus style rules and an example project.", input: z.object({}) },
  create_project: {
    description: "Start a new launch film. Returns projectId and the Studio URL the user is watching.",
    input: z.object({ name: z.string().min(1).max(80), url: z.string().url(), aspect: aspectSchema.default("16:9"), theme: themeSchema }),
  },
  put_scene: {
    description: "Add or replace one scene (matched by scene.id). Call once per scene, in order, so the user sees the film build live.",
    input: z.object({ projectId: id, scene: sceneSchema, index: z.number().int().min(0).optional() }),
  },
  set_theme: { description: "Replace the film's theme.", input: z.object({ projectId: id, theme: themeSchema }) },
  get_project: { description: "Read the current project, including edits the user made in the Studio.", input: z.object({ projectId: id }) },
  finish_project: { description: "Validate the whole film and mark it ready. Returns the Studio URL.", input: z.object({ projectId: id }) },
  save_asset: {
    description: "Attach an image you generated or found (meme, screenshot, logo). Prefer a public https URL; dataUrl up to 2 MB PNG/JPEG.",
    input: z.object({ projectId: id, kind: z.enum(["meme", "screenshot", "logo"]), url: httpsUrl.optional(), dataUrl: z.string().max(2_800_000).optional(), caption: z.string().max(300).optional() })
      .refine((a) => !!a.url !== !!a.dataUrl, "Send exactly one of url or dataUrl."),
  },
  draft_posts: {
    description: "Save launch copy written by you (the user's agent) for catalog channels. Drafts only; nothing is published.",
    input: z.object({ projectId: id, posts: z.array(z.object({ channelId: z.string(), text: z.string().min(1).max(5000), hashtags: z.array(z.string()).optional() })).min(1).max(20) }),
  },
} as const;

export const createProjectResult = z.object({ projectId: id, studioUrl: z.string().url() });
