"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PAGE_FRAMES, tc } from "./client";
import css from "./landing.module.css";

type Scene = { id: string; name: string; at: number };
const num = (i: number) => String(i + 1).padStart(2, "0");

export function Mark() {
  // A frame with a playhead in it.
  return (
    <span aria-hidden className="relative block size-[18px] rounded-[4px] bg-ink">
      <span className="absolute inset-y-[4px] left-[7px] w-[2px] bg-accent" />
    </span>
  );
}

/**
 * The page is a timeline. Every `[data-scene]` section is a scene; scroll position is the playhead.
 * Readouts are written straight to the DOM on scroll, React only re-renders when the layout changes.
 */
export function Hud() {
  const { scrollYProgress } = useScroll();
  const playX = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  const tcRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    let tops: number[] = [];
    let names: string[] = [];
    const update = (v: number) => {
      const y = window.scrollY + window.innerHeight * 0.4;
      const i = Math.max(0, tops.findLastIndex((t) => t <= y));
      if (tcRef.current) tcRef.current.textContent = tc(v * PAGE_FRAMES);
      if (numRef.current) numRef.current.textContent = `SCN ${num(i)}`;
      if (nameRef.current) nameRef.current.textContent = names[i] ?? "";
    };
    const measure = () => {
      const els = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      tops = els.map((el) => el.getBoundingClientRect().top + window.scrollY);
      names = els.map((el) => el.dataset.scene ?? "");
      setScenes(els.map((el, i) => ({ id: el.id, name: names[i], at: Math.min(1, tops[i] / max) })));
      update(scrollYProgress.get());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const off = scrollYProgress.on("change", update);
    return () => {
      ro.disconnect();
      off();
    };
  }, [scrollYProgress]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 justify-self-start text-[15px] font-semibold tracking-[-0.02em]">
            <Mark />
            Shipcast
          </Link>
          <p aria-hidden className="flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] uppercase tabular-nums">
            <span className="text-muted">
              <span ref={numRef}>SCN 01</span> <span ref={nameRef} className="max-sm:hidden">Hook</span>
            </span>
            <span ref={tcRef} className="text-ink">
              {tc(0)}
            </span>
          </p>
          <nav className="flex items-center gap-1 justify-self-end">
            <Link href="/distribution" className="rounded-[6px] px-3 py-2 text-[14px] text-muted transition-colors hover:text-ink max-md:hidden">
              Channels
            </Link>
            <Link href="/studio" className="press inline-flex h-9 items-center rounded-[6px] bg-ink px-3.5 text-[14px] font-medium text-canvas">
              <span className="max-sm:hidden">Open&nbsp;</span>Studio
            </Link>
          </nav>
        </div>
      </header>

      <nav aria-label="Scenes" className="fixed inset-x-0 bottom-0 z-50 h-5 overflow-hidden border-t border-line bg-canvas/90 backdrop-blur-md md:h-7">
        <div aria-hidden className={`absolute inset-0 ${css.ticks}`} />
        <motion.div aria-hidden style={{ scaleX: scrollYProgress }} className="absolute inset-0 origin-left bg-ink/[0.04]" />
        {scenes.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-label={`Scene ${num(i)}: ${s.name}`}
            style={{ left: `${s.at * 100}%` }}
            className={`absolute inset-y-0 border-ink/30 pt-[3px] whitespace-nowrap font-mono text-[9px] leading-none tracking-[0.08em] text-muted uppercase transition-colors hover:text-ink md:pt-[5px] md:text-[10px] ${s.at > 0.9 ? "-translate-x-full border-r pr-1.5" : "border-l pl-1.5"}`}
          >
            {num(i)}
            <span className="max-md:hidden"> {s.name}</span>
          </a>
        ))}
        {/* Inset by 1px so the playhead stays on screen at 100%. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-px left-0">
          <motion.div style={{ x: playX }} className="absolute inset-0">
            <span className="absolute inset-y-0 left-0 w-px bg-accent" />
            <span className="absolute -top-px -left-[3px] h-[5px] w-[7px] bg-accent" />
          </motion.div>
        </div>
      </nav>
    </>
  );
}
