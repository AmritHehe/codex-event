import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
if (!process.env.DATA_ROOT)
  throw new Error("Set DATA_ROOT to a persistent mounted volume.");
const root = process.env.DATA_ROOT;
for (const [key, path] of Object.entries({
  WORKSPACE_DATA_DIR: "workspaces",
  DISTRIBUTION_DATA_DIR: "distribution",
  RESEARCH_DATA_DIR: "research",
  LIMIT_DATA_DIR: "limits",
  RENDER_DATA_DIR: "render-owners",
}))
  process.env[key] ??= `${root}/${path}`;
process.env.RENDER_API_TOKEN ||= randomBytes(32).toString("hex");
process.env.RENDER_OUT_DIR ??= `${root}/renders`;
mkdirSync(root, { recursive: true });
const children = [];
const stop = () => children.forEach((child) => child.kill("SIGTERM"));
for (const [script, args] of [
  ["server/render.ts", []],
  ["node_modules/next/dist/bin/next", ["start", "--hostname", "0.0.0.0"]],
]) {
  const child = spawn(process.execPath, ["--import", "tsx", script, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
    stop();
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
