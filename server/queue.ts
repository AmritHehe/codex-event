import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { renderJob } from "../src/lib/contracts";
import type { Project } from "../src/video/schema";

export type RenderJob = z.infer<typeof renderJob>;
export type RenderTask = (project: Project, jobId: string, progress: (value: number) => void, workspaceId?: string) => Promise<void | string>;

/** The worker owns execution/timeouts; the queue always advances after success or failure. */
export class RenderQueue {
  private jobs = new Map<string, RenderJob>();
  private waiting: { project: Project; jobId: string; workspaceId?: string }[] = [];
  private active = false;
  private closed = false;

  constructor(private run: RenderTask, private maxWaiting = 20) {}

  get(jobId: string) { const job = this.jobs.get(jobId); return job ? { ...job } : undefined; }

  enqueue(project: Project, workspaceId?: string): RenderJob {
    if (this.closed) throw new Error("Render server is shutting down.");
    if (this.waiting.length >= this.maxWaiting) throw new Error("Render queue is full. Try again later.");
    const job: RenderJob = { jobId: randomUUID(), status: "queued", progress: 0 };
    this.jobs.set(job.jobId, job);
    this.waiting.push({ project: structuredClone(project), jobId: job.jobId, workspaceId });
    queueMicrotask(() => this.pump());
    return { ...job };
  }

  close() {
    this.closed = true;
    for (const { jobId } of this.waiting) Object.assign(this.jobs.get(jobId)!, { status: "error", error: "Render server stopped before this job started." });
    this.waiting = [];
  }

  private async pump() {
    if (this.active || this.closed) return;
    const task = this.waiting.shift();
    if (!task) return;
    this.active = true;
    const job = this.jobs.get(task.jobId)!;
    job.status = "rendering";
    try {
      const url = await this.run(task.project, task.jobId, (value) => {
        if (Number.isFinite(value)) job.progress = Math.max(job.progress, Math.min(0.99, Math.max(0, value)));
      }, task.workspaceId);
      Object.assign(job, { status: "done", progress: 1, url: url || `/files/${job.jobId}.mp4` });
    } catch (error) {
      Object.assign(job, { status: "error", error: error instanceof Error ? error.message : "Render failed. Please try again." });
    } finally {
      this.active = false;
      void this.pump();
    }
  }
}
