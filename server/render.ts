import { bundle } from "@remotion/bundler";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRenderServer } from "./http";
import { RenderQueue } from "./queue";
import { workerTask } from "./worker-task";

async function main() {
  const root = process.cwd();
  const outDir = resolve(root, "out");
  await mkdir(outDir, { recursive: true });
  console.log("Bundling LaunchVideo once for all render jobs…");
  const serveUrl = await bundle({ entryPoint: resolve(root, "src/video/index.ts"), outDir: resolve(outDir, "bundle") });
  const queue = new RenderQueue(workerTask(root, serveUrl, outDir));
  const origins = process.env.RENDER_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  const server = createRenderServer(queue, outDir, origins);
  const port = Number(process.env.RENDER_PORT ?? 3200);
  const host = process.env.RENDER_HOST ?? "127.0.0.1";
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Render server ready on http://${host}:${port}`));
  const stop = () => { queue.close(); server.close(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
