// API contract between the frontend track (UI) and the backend track (route handlers + render server).
// Both sides import these schemas. Changing one is a breaking change: do it in its own small PR.
import { z } from "zod";
import { projectSchema } from "@/video/schema";

export const apiError = z.object({ error: z.string() });

// POST /api/generate: product URL -> first draft of the launch video.
export const generateRequest = z.object({ url: z.string().url() });
export const generateResponse = z.object({
  project: projectSchema,
  brand: z.object({
    name: z.string(),
    tagline: z.string().optional(),
    colors: z.array(z.string()),
    logo: z.string().url().optional(),
    screenshot: z.string().url().optional(),
  }),
});

// POST /api/edit: natural-language change to the current project.
export const editRequest = z.object({
  project: projectSchema,
  instruction: z.string().min(1).max(500),
  selection: z.object({ sceneId: z.string(), layerId: z.string().nullable() }).optional(),
});
export const editResponse = z.object({ project: projectSchema, summary: z.string() });

// POST /api/kit: copy for each channel, generated from the project.
export const kitRequest = z.object({ project: projectSchema, channels: z.array(z.string()).min(1) });
export const kitResponse = z.object({
  posts: z.array(z.object({ channelId: z.string(), text: z.string(), hashtags: z.array(z.string()).optional() })),
});

// Render server (separate Node process): POST {RENDER_URL}/render, GET {RENDER_URL}/render/:jobId
export const renderRequest = z.object({ project: projectSchema });
export const renderJob = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "rendering", "done", "error"]),
  progress: z.number().min(0).max(1),
  url: z.string().optional(),
  error: z.string().optional(),
});

export const RENDER_URL = process.env.NEXT_PUBLIC_RENDER_URL ?? "http://localhost:3200";

/** Typed POST for the frontend: validates the response, throws the server's error message on failure. */
export async function postJson<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiError.safeParse(data).data?.error ?? `Request failed (${res.status})`);
  return schema.parse(data);
}
