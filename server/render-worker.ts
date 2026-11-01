import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import type { Project } from "../src/video/schema";

export type WorkerInput = { project: Project; serveUrl: string; outputLocation: string; browserExecutable?: string };
export type WorkerOutput = { type: "progress"; progress: number } | { type: "done" } | { type: "error"; message: string };
const send = (message: WorkerOutput) => process.send?.(message);

process.once("message", async (input: WorkerInput) => {
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  let succeeded = false;
  try {
    browser = await openBrowser("chrome", { browserExecutable: input.browserExecutable });
    const inputProps = { project: input.project };
    const composition = await selectComposition({ serveUrl: input.serveUrl, id: "LaunchVideo", inputProps, puppeteerInstance: browser, timeoutInMilliseconds: 30_000 });
    await renderMedia({
      composition, inputProps, serveUrl: input.serveUrl,
      outputLocation: input.outputLocation, codec: "h264", pixelFormat: "yuv420p",
      puppeteerInstance: browser, concurrency: 2, timeoutInMilliseconds: 30_000,
      onProgress: ({ progress }) => send({ type: "progress", progress }),
    });
    succeeded = true;
  } catch (error) {
    console.error("Render worker failed:", error);
    send({ type: "error", message: "Video render failed. Check the project assets and render server logs, then retry." });
  } finally {
    await browser?.close({ silent: true }).catch(() => {});
    if (succeeded) send({ type: "done" });
    process.disconnect();
  }
});
