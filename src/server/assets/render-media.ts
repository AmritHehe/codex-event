import { renderJob } from "@/lib/contracts";
import { DistributionError } from "../distribution/http";
export async function resolveRenderMedia(jobId: string, fetcher: typeof fetch = fetch, workspaceId?: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(jobId)) throw new DistributionError(400, "Invalid render job ID.");
  const base = new URL(process.env.RENDER_SERVICE_URL ?? "http://127.0.0.1:3200");
  if (base.username || base.password || !["http:", "https:"].includes(base.protocol)) throw new DistributionError(503, "Configure the render service URL.");
  const response = await fetcher(new URL(`/render/${jobId}`, base), { headers: { ...(process.env.RENDER_API_TOKEN ? { Authorization: `Bearer ${process.env.RENDER_API_TOKEN}` } : {}), ...(workspaceId ? {"X-Workspace-Id":workspaceId} : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) throw new DistributionError(404, "Render job not found.");
  if (!response.ok) throw new DistributionError(502, "Could not read render status.");
  const job = renderJob.parse(await response.json());
  if (job.jobId !== jobId || job.status !== "done" || !job.url?.startsWith("https://")) throw new DistributionError(409, "Finish the render and enable Blob uploads before publishing it.");
  return job.url;
}
