import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { renderJob } from "../src/lib/contracts";
import type { Project } from "../src/video/schema";

export type RenderJob = z.infer<typeof renderJob>;
export type RenderTask = (
  project: Project,
  jobId: string,
  progress: (value: number) => void,
  workspaceId?: string,
) => Promise<void | string>;

/** The worker owns execution/timeouts; the queue always advances after success or failure. */
export class RenderQueue {
  private jobs = new Map<string, RenderJob>();
  private owners = new Map<string, string>();
  owns(jobId: string, workspaceId: string) {
    return this.owners.get(jobId) === workspaceId;
  }
  private waiting: { project: Project; jobId: string; workspaceId?: string }[] =
    [];
  private active = false;
  private closed = false;

  constructor(
    private run: RenderTask,
    private maxWaiting = 20,
    private historyDir?: string,
  ) {
    if (historyDir) {
      mkdirSync(historyDir, { recursive: true });
      for (const name of readdirSync(historyDir).filter((n) =>
        /^[a-f0-9-]{36}\.json$/.test(n),
      )) {
        const saved = JSON.parse(readFileSync(join(historyDir, name), "utf8"));
        const job = renderJob.parse(saved.job);
        if (!["done", "error"].includes(job.status))
          Object.assign(job, {
            status: "error",
            error: "Render interrupted by a server restart. Please retry.",
          });
        this.jobs.set(job.jobId, job);
        if (saved.workspaceId) this.owners.set(job.jobId, saved.workspaceId);
      }
    }
  }
  private persist(job: RenderJob) {
    if (!this.historyDir) return;
    const file = join(this.historyDir, `${job.jobId}.json`);
    writeFileSync(
      `${file}.tmp`,
      JSON.stringify({ job, workspaceId: this.owners.get(job.jobId) }),
      { mode: 0o600 },
    );
    renameSync(`${file}.tmp`, file);
  }

  get(jobId: string) {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : undefined;
  }

  enqueue(project: Project, workspaceId?: string): RenderJob {
    if (this.closed) throw new Error("Render server is shutting down.");
    if (this.waiting.length >= this.maxWaiting)
      throw new Error("Render queue is full. Try again later.");
    const job: RenderJob = {
      jobId: randomUUID(),
      status: "queued",
      progress: 0,
    };
    this.jobs.set(job.jobId, job);
    if (workspaceId) this.owners.set(job.jobId, workspaceId);
    this.persist(job);
    this.waiting.push({
      project: structuredClone(project),
      jobId: job.jobId,
      workspaceId,
    });
    queueMicrotask(() => this.pump());
    return { ...job };
  }

  close() {
    this.closed = true;
    for (const { jobId } of this.waiting)
      Object.assign(this.jobs.get(jobId)!, {
        status: "error",
        error: "Render server stopped before this job started.",
      });
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
      const url = await this.run(
        task.project,
        task.jobId,
        (value) => {
          if (Number.isFinite(value))
            job.progress = Math.max(
              job.progress,
              Math.min(0.99, Math.max(0, value)),
            );
        },
        task.workspaceId,
      );
      Object.assign(job, {
        status: "done",
        progress: 1,
        url: url || `/files/${job.jobId}.mp4`,
      });
    } catch (error) {
      Object.assign(job, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Render failed. Please try again.",
      });
    } finally {
      try {
        this.persist(job);
      } catch {
        job.status = "error";
        job.error = "Could not persist render status. Check server storage.";
      }
      this.active = false;
      void this.pump();
    }
  }
}
