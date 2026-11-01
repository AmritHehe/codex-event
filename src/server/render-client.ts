import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ApiError } from "./http";
import { renderJob } from "@/lib/contracts";
const dir = () =>
  resolve(
    /*turbopackIgnore: true*/ process.env.RENDER_DATA_DIR ??
      ".data/render-owners",
  );
export function renderFetch(
  path: string,
  workspaceId: string,
  init: RequestInit = {},
) {
  const key = process.env.RENDER_API_TOKEN;
  if (process.env.NODE_ENV === "production" && (!key || key.length < 24))
    throw new ApiError(
      503,
      "Configure a private render service and a render key of at least 24 characters.",
    );
  return fetch(
    new URL(path, process.env.RENDER_SERVICE_URL ?? "http://127.0.0.1:3200"),
    {
      ...init,
      headers: {
        ...init.headers,
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        "X-Workspace-Id": workspaceId,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    },
  );
}
export async function recordRender(
  workspaceId: string,
  jobId: string,
  name: string,
) {
  const folder = join(dir(), workspaceId);
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, jobId),
    JSON.stringify({ jobId, name, createdAt: Date.now() }),
    { mode: 0o600 },
  );
}
export async function ownedRender(workspaceId: string, jobId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(jobId))
    throw new ApiError(404, "Render not found.");
  try {
    await readFile(join(dir(), workspaceId, jobId));
  } catch {
    throw new ApiError(404, "Render not found in your workspace.");
  }
}
export async function listRenders(workspaceId: string) {
  const folder = join(dir(), workspaceId);
  const names = await readdir(folder).catch(() => []);
  const records = (
    await Promise.all(
      names.map(async (id) => {
        try {
          return JSON.parse(await readFile(join(folder, id), "utf8"));
        } catch {
          return null;
        }
      }),
    )
  )
    .filter(Boolean)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 20);
  return (
    await Promise.all(
      records.map(async (metadata) => {
        const id = metadata.jobId;
        try {
          const response = await renderFetch(`/render/${id}`, workspaceId);
          if (!response.ok) return null;
          return {
            ...renderJob.parse(await response.json()),
            name: metadata.name,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);
}
