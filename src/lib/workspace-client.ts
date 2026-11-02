let pending: Promise<void> | undefined;
/** Establish a workspace without rotating an existing agent token. Coalesce concurrent callers. */
export function ensureWorkspace() {
  return pending ??= (async () => {
    const current = await fetch("/api/workspace", {cache:"no-store"});
    if (current.ok) return;
    if (current.status !== 401) throw new Error("Could not read your workspace. Try again.");
    const created = await fetch("/api/workspace", {method:"POST"});
    if (!created.ok) throw new Error("Workspace creation is unavailable. Try again later.");
  })().finally(() => { pending = undefined; });
}
