"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Remaining server-paid credits for this workspace; hidden until a workspace exists. */
export function CreditsBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/workspace", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((w) => live && typeof w?.credits === "number" && setCredits(w.credits))
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  if (credits === null) return null;
  return (
    <Link
      href="/connect"
      title="Server-paid AI credits. Connect your own agent to build films on your plan."
      className="hidden h-7 items-center rounded-md border border-line px-2 font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase tabular-nums hover:text-ink sm:inline-flex"
    >
      <span className={credits > 0 ? "text-ink" : "text-accent"}>{credits}</span>&nbsp;credits
    </Link>
  );
}
