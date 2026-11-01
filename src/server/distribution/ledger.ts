import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { publishReceipt, type PublishInput, type PublishReceipt } from "@/lib/distribution-contracts";
import { DistributionError } from "./http";

const schema = z.record(z.string(), z.object({ fingerprint: z.string(), state: z.enum(["pending", "complete", "unknown"]), receipt: publishReceipt.optional() }));
type Ledger = z.infer<typeof schema>;
const digest = (input: PublishInput) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

export class PublicationLedger {
  constructor(private dir = resolve(/*turbopackIgnore: true*/ process.env.DISTRIBUTION_DATA_DIR ?? ".data/distribution")) {}
  private async transaction<T>(change: (ledger: Ledger) => T): Promise<T> {
    await mkdir(this.dir, { recursive: true });
    const lock = join(this.dir, "lock");
    let acquired = false;
    for (let i = 0; i < 100; i++) {
      try { await mkdir(lock); acquired = true; break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const info = await stat(lock).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 60_000) await rm(lock, { recursive: true, force: true });
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    if (!acquired) throw new DistributionError(503, "Publication history is busy. Try again shortly.");
    try {
      let ledger: Ledger;
      try { ledger = schema.parse(JSON.parse(await readFile(join(this.dir, "posts.json"), "utf8"))); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") ledger = {};
        else throw new DistributionError(503, "Publication history is unavailable. Check the server data directory before posting.");
      }
      const result = change(ledger);
      const temporary = join(this.dir, "posts.tmp");
      await writeFile(temporary, JSON.stringify(ledger), { mode: 0o600 });
      await rename(temporary, join(this.dir, "posts.json"));
      return result;
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
  recover(input: PublishInput) {
    return this.transaction((ledger) => {
      const existing = ledger[input.requestId];
      if (!existing) return null;
      if (existing.fingerprint !== digest(input)) throw new DistributionError(409, "This request ID was already used for a different draft.");
      if (existing.state === "complete") return existing.receipt!;
      throw new DistributionError(409, "A previous attempt may have reached the channel. Check the account before submitting a new request.");
    });
  }
  reserve(input: PublishInput) {
    return this.transaction((ledger) => {
      const existing = ledger[input.requestId];
      if (existing) {
        if (existing.fingerprint !== digest(input)) throw new DistributionError(409, "This request ID was already used for a different draft.");
        if (existing.state === "complete") return existing.receipt!;
        throw new DistributionError(409, "A previous attempt may have reached the channel. Check the account before submitting a new request.");
      }
      ledger[input.requestId] = { fingerprint: digest(input), state: "pending" };
      return null;
    });
  }
  finish(input: PublishInput, receipt?: PublishReceipt) {
    return this.transaction((ledger) => { ledger[input.requestId] = { fingerprint: digest(input), state: receipt ? "complete" : "unknown", receipt }; });
  }
}
