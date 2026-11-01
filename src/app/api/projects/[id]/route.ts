import { projectResponse } from "@/lib/agent-contracts";
import { json, withWorkspace } from "@/server/workspace/http";
import { toProject, workspaces } from "@/server/workspace/store";
import { projectSchema } from "@/video/schema";

const MAX_BODY = 1_000_000;

/** The project the user's agent is building. Only readable by its own workspace (404 otherwise). */
export const GET = withWorkspace(async (workspaceId, _request, context: RouteContext<"/api/projects/[id]">) => {
  const project = await workspaces().getProject(workspaceId, (await context.params).id);
  if (!project) return json({ error: "Project not found." }, 404);
  return json(projectResponse.parse({ project: toProject(project), status: project.status }));
});

/**
 * The Studio saves the user's manual edits back so the agent's `get_project` sees them. Publishes no event:
 * the Studio refetches on agent events, so emitting one here would echo the edit back into the editor.
 */
export const PUT = withWorkspace(async (workspaceId, request, context: RouteContext<"/api/projects/[id]">) => {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "Project is too large (1 MB max)." }, 413);
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY) return json({ error: "Project is too large (1 MB max)." }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return json({ error: "Body must be JSON: { project }." }, 400); }
  const parsed = projectSchema.safeParse((body as { project?: unknown } | null)?.project);
  if (!parsed.success) return json({ error: `Invalid project: ${parsed.error.issues[0]?.message ?? "bad shape"}.` }, 400);
  const { name, aspect, theme, scenes } = parsed.data;
  const project = await workspaces().updateProject(workspaceId, (await context.params).id, (p) => {
    Object.assign(p, { name, aspect, theme, scenes });
    return p;
  });
  return json(projectResponse.parse({ project: toProject(project), status: project.status }));
});
