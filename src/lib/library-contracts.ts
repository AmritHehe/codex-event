import { z } from "zod";
import { connection } from "./agent-contracts";

export const libraryAsset = z.object({ id: z.string(), kind: z.enum(["meme", "screenshot", "logo"]), caption: z.string().optional(), url: z.string() });
export const libraryDraft = z.object({ channelId: z.string(), text: z.string(), hashtags: z.array(z.string()).optional() });
export const libraryProject = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["building", "ready"]),
  updatedAt: z.string(),
  scenes: z.number().int().min(0),
  url: z.string().optional(),
  drafts: z.array(libraryDraft),
  assets: z.array(libraryAsset),
});
/** GET /api/workspace/library: everything the dashboard shows, newest project first. */
export const libraryResponse = z.object({ credits: z.number().int().min(0), connections: z.array(connection), projects: z.array(libraryProject) });
export type LibraryResponse = z.infer<typeof libraryResponse>;
