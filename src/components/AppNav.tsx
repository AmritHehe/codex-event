"use client";

import { BroadcastIcon, FilmStripIcon, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; icon: Icon }[] = [
  { href: "/studio", label: "Studio", icon: FilmStripIcon },
  { href: "/distribution", label: "Distribute", icon: BroadcastIcon },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
      <Link href="/studio" aria-label="Shipcast home" className="press mb-3 grid size-9 place-items-center rounded-lg bg-ink text-[15px] font-semibold text-white">
        S
      </Link>
      {LINKS.map(({ href, label, icon: I }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`press flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <I size={20} weight={active ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
