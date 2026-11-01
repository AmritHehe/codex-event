"use client";

import { BroadcastIcon, FilmStripIcon, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; icon: Icon }[] = [
  { href: "/studio", label: "Studio", icon: FilmStripIcon },
  { href: "/distribution", label: "Distribute", icon: BroadcastIcon },
];

/** Brand mark: three tracks and a playhead. */
function Mark() {
  return (
    <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
      <rect width="28" height="28" rx="6" className="fill-ink" />
      <rect x="6" y="8" width="16" height="2.5" rx="1" fill="#fbfbfa" />
      <rect x="6" y="12.75" width="10" height="2.5" rx="1" fill="#fbfbfa" opacity="0.7" />
      <rect x="6" y="17.5" width="13" height="2.5" rx="1" fill="#fbfbfa" opacity="0.45" />
      <rect x="17.5" y="5" width="1.5" height="18" className="fill-accent" />
    </svg>
  );
}

/** App rail: vertical on desktop, a top bar below lg. Shared by /studio and /distribution. */
export function AppNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="App"
      className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel px-2 lg:h-full lg:w-14 lg:flex-col lg:border-r lg:border-b-0 lg:px-0 lg:py-2"
    >
      <Link href="/" aria-label="Shipcast home" className="press mr-2 grid size-9 place-items-center rounded-md lg:mr-0 lg:mb-3">
        <Mark />
      </Link>
      {LINKS.map(({ href, label, icon: I }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`press relative flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium lg:h-12 lg:w-12 lg:flex-col lg:justify-center lg:gap-1 lg:px-0 lg:text-[9.5px] ${
              active ? "bg-hover text-ink" : "text-muted hover:bg-hover/70 hover:text-ink"
            }`}
          >
            {active && <span aria-hidden className="absolute inset-x-2 -bottom-[6px] h-px bg-ink lg:inset-x-auto lg:inset-y-2 lg:bottom-auto lg:-left-1 lg:h-auto lg:w-px" />}
            <I size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
