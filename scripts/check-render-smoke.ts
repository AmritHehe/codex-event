import assert from "node:assert/strict";
import { bundle } from "@remotion/bundler";
import { getVideoMetadata } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { workerTask } from "../server/worker-task";
import { sampleProject } from "../src/video/sample";
import { ASPECTS, aspectSchema, FPS, projectDuration } from "../src/video/schema";

async function main() {
  const outDir = resolve("out/smoke"); await mkdir(outDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: resolve("src/video/index.ts"), outDir: resolve(outDir, "bundle") });
  const run = workerTask(process.cwd(), serveUrl, outDir);
  for (const aspect of aspectSchema.options) {
    const project = { ...sampleProject, aspect };
    const jobId = randomUUID();
    await run(project, jobId, () => {});
    const metadata = await getVideoMetadata(resolve(outDir, `${jobId}.mp4`));
    assert.equal(metadata.width, ASPECTS[aspect].width);
    assert.equal(metadata.height, ASPECTS[aspect].height);
    assert.ok(typeof metadata.durationInSeconds === "number");
    assert.ok(Math.abs(metadata.durationInSeconds - projectDuration(project) / FPS) < 1 / FPS);
    console.log(`${aspect}: ${metadata.width}x${metadata.height}, ${metadata.durationInSeconds}s, ${jobId}.mp4`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
