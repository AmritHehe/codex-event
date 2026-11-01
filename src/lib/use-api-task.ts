"use client";

import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { apiError } from "./contracts";

/** One cancellable request at a time. Unmounts never update state. */
export function useApiTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  async function run<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T | null> {
    if (active.current) return null;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(apiError.safeParse(data).data?.error || `Request failed (${response.status}).`);
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new Error("The server returned an invalid result. Please try again.");
      return controller.signal.aborted ? null : parsed.data;
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The request failed. Please try again.");
      return null;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  return { busy, error, setError, run, cancel: () => { active.current?.abort(); active.current = null; setBusy(false); } };
}
