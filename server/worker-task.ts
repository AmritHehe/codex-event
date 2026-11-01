import { fork } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { RenderTask } from "./queue";
import type { WorkerInput, WorkerOutput } from "./render-worker";

/** Isolate crashes and kill stuck Chromium/render jobs before allowing the next job. */
export function workerTask(root: string, serveUrl: string, outDir: string, timeoutMs = 480_000): RenderTask {
  return async (project, jobId, progress) => {
    const outputLocation = join(outDir, `${jobId}.mp4`);
    try {
      await new Promise<void>((resolve, reject) => {
        const child = fork(join(root, "server/render-worker.ts"), [], { cwd: root, execArgv: ["--import", "tsx"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
        let done = false;
        let failure = "The render process stopped unexpectedly. Please retry.";
        const timer = setTimeout(() => { failure = "Render timed out. Try a shorter video or check its assets."; child.kill("SIGKILL"); }, timeoutMs);
        child.on("message", (message: WorkerOutput) => {
          if (message.type === "progress") progress(message.progress);
          if (message.type === "done") done = true;
          if (message.type === "error") failure = message.message;
        });
        child.once("error", (error) => { clearTimeout(timer); reject(error); });
        child.once("exit", (code) => { clearTimeout(timer); if (done && code === 0) resolve(); else reject(new Error(failure)); });
        child.send({ project, serveUrl, outputLocation, browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE } satisfies WorkerInput);
      });
    } catch (error) {
      await rm(outputLocation, { force: true });
      throw error;
    }
  };
}
