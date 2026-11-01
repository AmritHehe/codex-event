"use client";

// Demo-only publish flow for judging: nothing leaves the browser. Loaded client-only (Remotion).
import { InstagramLogoIcon, LinkedinLogoIcon, TiktokLogoIcon, XIcon, XLogoIcon, YoutubeLogoIcon, type Icon } from "@phosphor-icons/react";
import { Player } from "@remotion/player";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { label, mono, primary, small } from "@/distribution/ui";
import { projectResponse } from "@/lib/agent-contracts";
import { LaunchVideo } from "@/video/LaunchVideo";
import { sampleProject } from "@/video/sample";
import { ASPECTS, FPS, projectDuration, type Aspect, type Project } from "@/video/schema";

export type PublishTarget = { id: string | null; name: string; drafts: { channelId: string; text: string; hashtags?: string[] | null }[] };

const PLATFORMS: { id: string; name: string; icon: Icon; aspect: Aspect; handle: string }[] = [
  { id: "instagram", name: "Instagram Reels", icon: InstagramLogoIcon, aspect: "9:16", handle: "@yourbrand" },
  { id: "tiktok", name: "TikTok", icon: TiktokLogoIcon, aspect: "9:16", handle: "@yourbrand" },
  { id: "youtube-shorts", name: "YouTube Shorts", icon: YoutubeLogoIcon, aspect: "9:16", handle: "@yourbrand" },
  { id: "x", name: "X", icon: XLogoIcon, aspect: "16:9", handle: "@yourbrand" },
  { id: "linkedin-personal", name: "LinkedIn", icon: LinkedinLogoIcon, aspect: "1:1", handle: "Your Name" },
];

const FRAME_WIDTH: Record<Aspect, string> = { "9:16": "min(300px, 100%)", "16:9": "min(560px, 100%)", "1:1": "min(440px, 100%)" };

const Badge = () => (
  <span className={`${mono} inline-flex items-center rounded-md border border-accent px-2 py-1 text-accent`}>DEMO MODE: nothing is posted</span>
);

type Receipt = { postId: string; at: string };

export function PublishDemo({ target, onClose }: { target: PublishTarget; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduce = useReducedMotion();
  const [project, setProject] = useState<Project>(sampleProject);
  const [tab, setTab] = useState(PLATFORMS[0].id);
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLATFORMS.map((p) => {
        const d = target.drafts.find((x) => x.channelId === p.id);
        return [p.id, d ? [d.text, d.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")].filter(Boolean).join("\n\n") : ""];
      }),
    ),
  );
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});

  // Native modal dialog: inert background (focus trap) and Esc via the cancel event.
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (!target.id) return;
    let live = true;
    fetch(`/api/projects/${encodeURIComponent(target.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const parsed = projectResponse.safeParse(json);
        if (live && parsed.success && parsed.data.project.scenes.length > 0) setProject(parsed.data.project as Project);
      })
      .catch(() => {}); // sample project stays as the fallback
    return () => {
      live = false;
    };
  }, [target.id]);

  const platform = PLATFORMS.find((p) => p.id === tab)!;
  const { width, height } = ASPECTS[platform.aspect];
  const busy = progress[tab] !== undefined;
  const receipt = receipts[tab];

  const publish = () => {
    const id = tab;
    const start = performance.now();
    setProgress((p) => ({ ...p, [id]: 0 }));
    const timer = setInterval(() => {
      const v = Math.min(1, (performance.now() - start) / 1500);
      setProgress((p) => ({ ...p, [id]: v }));
      if (v < 1) return;
      clearInterval(timer);
      setProgress((p) => {
        const rest = { ...p };
        delete rest[id];
        return rest;
      });
      setReceipts((r) => ({ ...r, [id]: { postId: `demo_${id}_${Math.random().toString(36).slice(2, 10)}`, at: new Date().toLocaleString() } }));
    }, 50);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="publish-title"
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-canvas text-ink backdrop:bg-ink/40"
    >
      <div className="mx-auto max-w-[1440px] px-4 pb-16 md:px-10">
        <div className={`${label} flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5`}>
          <Badge />
          <button onClick={() => ref.current?.close()} className={`${small} inline-flex items-center gap-1.5`} aria-label="Close publish demo">
            <XIcon size={12} /> Esc
          </button>
        </div>

        <header className="pt-8 pb-6">
          <p className={label}>Publish{target.id ? "" : " · sample project"}</p>
          <h2 id="publish-title" className="mt-3 text-[clamp(32px,5vw,64px)] leading-[0.95] font-semibold tracking-[-0.05em]">
            {target.name}
          </h2>
        </header>

        <div role="tablist" aria-label="Platform" className="flex flex-wrap border-t border-b border-line">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === tab}
              onClick={() => setTab(p.id)}
              className={`${mono} -mb-px inline-flex items-center gap-2 border-b px-4 py-3 ${p.id === tab ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              <p.icon size={14} /> {p.name}
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={platform.name} className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Generic post frame: neutral chrome, brand only via the Phosphor glyph. */}
          <div className="flex justify-center">
            <article
              className={`overflow-hidden border border-line bg-panel ${platform.aspect === "9:16" ? "rounded-[28px] p-2" : "rounded-[10px]"}`}
              style={{ width: FRAME_WIDTH[platform.aspect] }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="grid size-7 place-items-center rounded-full border border-line">
                  <platform.icon size={14} />
                </span>
                <span className="text-[13px] font-medium">{platform.handle}</span>
                <span className={`${label} ml-auto`}>{platform.aspect}</span>
              </div>
              <div className={platform.aspect === "9:16" ? "overflow-hidden rounded-[20px]" : ""} style={{ aspectRatio: `${width} / ${height}` }}>
                <Player
                  key={`${project.id}-${platform.aspect}`}
                  component={LaunchVideo}
                  inputProps={{ project: { ...project, aspect: platform.aspect } }}
                  durationInFrames={Math.max(1, projectDuration(project))}
                  compositionWidth={width}
                  compositionHeight={height}
                  fps={FPS}
                  style={{ width: "100%", height: "100%" }}
                  autoPlay={!reduce}
                  controls={!!reduce}
                  loop
                  acknowledgeRemotionLicense
                />
              </div>
              <p className="line-clamp-3 px-3 py-3 text-[13px] leading-[1.5] whitespace-pre-wrap text-muted">{captions[tab] || "Your caption appears here."}</p>
            </article>
          </div>

          <div className="min-w-0">
            <label htmlFor="caption" className={label}>
              Caption · {platform.name}
            </label>
            <textarea
              id="caption"
              value={captions[tab]}
              onChange={(e) => setCaptions((c) => ({ ...c, [tab]: e.target.value }))}
              rows={8}
              placeholder="Write a caption"
              className="mt-2 block w-full rounded-[6px] border border-line bg-canvas px-3.5 py-2.5 text-[14px] leading-[1.5] focus:border-ink"
            />

            <button onClick={publish} disabled={busy} className={`${primary} mt-5 h-14 w-full text-[16px]`}>
              {busy ? "Publishing" : receipt ? "Publish again" : `Publish to ${platform.name}`}
            </button>

            {busy && (
              <div role="progressbar" aria-label="Publishing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress[tab] * 100)} className="mt-4 h-1 bg-line">
                <div className="h-full bg-accent transition-[width] duration-75 motion-reduce:transition-none" style={{ width: `${progress[tab] * 100}%` }} />
              </div>
            )}

            {receipt && !busy && (
              <div role="status" className="mt-6 rounded-[10px] border border-line p-4">
                <Badge />
                <p className="mt-4 text-[17px] font-medium">Published (demo)</p>
                <dl className={`${label} mt-3 grid grid-cols-[90px_minmax(0,1fr)] gap-y-1.5`}>
                  <dt>Platform</dt>
                  <dd className="text-ink">{platform.name}</dd>
                  <dt>Post id</dt>
                  <dd className="truncate text-ink normal-case">{receipt.postId}</dd>
                  <dt>Time</dt>
                  <dd className="text-ink">{receipt.at}</dd>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
