import { renderRequest, renderJob } from "@/lib/contracts";
import { jsonRoute } from "@/server/http";
import { workspaceFrom, withWorkspace, json } from "@/server/workspace/http";
import { ApiError } from "@/server/http";
import { limit, sameOrigin } from "@/server/limits";
import { renderFetch, recordRender, listRenders } from "@/server/render-client";
export const GET = withWorkspace(async (id) =>
  json({ jobs: await listRenders(id) }),
);
export const POST = (request: Request) =>
  jsonRoute(renderRequest, renderJob, async ({ project }) => {
    sameOrigin(request);
    const id = await workspaceFrom(request);
    if (!id) throw new ApiError(401, "Create a workspace before rendering.");
    await limit(`render:${id}`, 20);
    await limit("render:global", 100);
    const response = await renderFetch("/render", id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    if (!response.ok)
      throw new ApiError(
        response.status === 503 ? 503 : 502,
        "Render server could not start this export.",
      );
    const job = renderJob.parse(await response.json());
    await recordRender(id, job.jobId, `${project.name} · ${project.aspect}`);
    return job;
  })(request);
