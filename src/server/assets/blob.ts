import { put } from "@vercel/blob";
import { createHash, randomUUID } from "node:crypto";
import { DistributionError } from "../distribution/http";
export type AssetType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4";
const extensions: Record<AssetType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4" };
export async function putAsset(workspaceId: string, bytes: Uint8Array, type: AssetType): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new DistributionError(503, "Configure Vercel Blob storage before uploading assets.");
  if (!bytes.byteLength || bytes.byteLength > (type === "video/mp4" ? 100_000_000 : 5_000_000)) throw new DistributionError(413, "Asset exceeds the upload limit.");
  const prefix = createHash("sha256").update(workspaceId).digest("hex");
  const result = await put(`workspaces/${prefix}/${randomUUID()}.${extensions[type]}`, Buffer.from(bytes), { access: "public", contentType: type, addRandomSuffix: false, abortSignal: AbortSignal.timeout(120_000) });
  return result.url;
}
export function decodeImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new DistributionError(400, "Provide a base64 PNG or JPEG data URL.");
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid || bytes.length > 2_000_000) throw new DistributionError(400, "Invalid image or image exceeds 2 MB.");
  return { bytes, type: match[1] as AssetType };
}
/** Firecrawl screenshots have a trusted provider origin, not an arbitrary user URL. */
export async function archiveScreenshot(workspaceId: string, url: string, signal: AbortSignal) {
  const parsed = new URL(url);
  const allowed = (process.env.SCREENSHOT_ASSET_HOSTS ?? "storage.googleapis.com,firecrawl.dev,supabase.co").split(",");
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) throw new DistributionError(502, "Configure the trusted Firecrawl screenshot storage host.");
  const response = await fetch(url, { signal, redirect: "error" });
  const type = response.headers.get("content-type")?.split(";")[0] as AssetType;
  if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(type)) throw new DistributionError(502, "Could not archive the product screenshot.");
  const reader = response.body?.getReader(); if (!reader) throw new Error("Missing screenshot");
  let length = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 5_000_000) { await reader.cancel(); throw new DistributionError(413, "Screenshot exceeds 5 MB."); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return putAsset(workspaceId, Buffer.concat(chunks), type);
}
