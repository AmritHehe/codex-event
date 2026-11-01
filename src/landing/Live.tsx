"use client";

import { Player, Thumbnail } from "@remotion/player";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Segmented } from "@/editor/ui";
import { focusFrame } from "@/editor/store";
import { LaunchVideo } from "@/video/LaunchVideo";
import { sampleProject } from "@/video/sample";
import { ASPECTS, aspectSchema, FPS, projectDuration, type Aspect, type Project } from "@/video/schema";
import { THEME_PRESETS } from "@/video/themes";

const ratio = (a: Aspect) => ASPECTS[a].width / ASPECTS[a].height;

/** Hero: the real engine playing the sample launch, re-laid-out live per aspect. */
export function HeroPlayer() {
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const reduce = useReducedMotion();
  const project = { ...sampleProject, aspect };
  const { width, height } = ASPECTS[aspect];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Height follows the format so 16:9 on a phone doesn't float in empty space. */}
      <div
        className="grid w-full place-items-center [container-type:size]"
        style={{ height: `min(500px, 50vh, calc((100vw - 32px) / ${ratio(aspect)}))` }}
      >
        <motion.div
          key={aspect}
          initial={reduce ? false : { opacity: 0, filter: "blur(6px)", transform: "scale(0.98)" }}
          animate={{ opacity: 1, filter: "blur(0px)", transform: "scale(1)" }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-24px_rgb(24_24_27/0.28),0_0_0_1px_rgb(24_24_27/0.06)]"
          style={{ aspectRatio: `${width} / ${height}`, width: `min(100cqw, 100cqh * ${ratio(aspect)})` }}
        >
          <Player
            component={LaunchVideo}
            inputProps={{ project }}
            durationInFrames={projectDuration(project)}
            compositionWidth={width}
            compositionHeight={height}
            fps={FPS}
            style={{ width: "100%", height: "100%" }}
            initialFrame={focusFrame(project, reduce ? "product" : "hook")}
            autoPlay={!reduce}
            controls={!!reduce}
            loop
            acknowledgeRemotionLicense
          />
        </motion.div>
      </div>
      <div className="w-60">
        <Segmented label="Video format" value={aspect} options={aspectSchema.options} onChange={setAspect} />
      </div>
    </div>
  );
}

function Thumb({ project, frame }: { project: Project; frame: number }) {
  const { width, height } = ASPECTS[project.aspect];
  return (
    <div className="w-full overflow-hidden rounded-lg ring-1 ring-black/5" style={{ aspectRatio: `${width} / ${height}` }}>
      <Thumbnail
        component={LaunchVideo}
        inputProps={{ project }}
        compositionWidth={width}
        compositionHeight={height}
        durationInFrames={projectDuration(project)}
        fps={FPS}
        frameToDisplay={frame}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function AspectStrip() {
  return (
    <div className="flex max-w-[640px] items-end gap-3">
      {(["9:16", "1:1", "16:9"] as const).map((aspect) => {
        const p = { ...sampleProject, aspect };
        // Width proportional to aspect ratio = equal heights, and the strip never overflows.
        return (
          <div key={aspect} className="flex min-w-0 flex-col items-center gap-2" style={{ flex: `${ratio(aspect)} 1 0` }}>
            <Thumb project={p} frame={focusFrame(p, "product", "d2")} />
            <span className="font-mono text-[11px] text-muted">{aspect}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ThemeGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEME_PRESETS.slice(0, 4).map((t) => {
        const p = { ...sampleProject, theme: t.theme };
        return <Thumb key={t.name} project={p} frame={focusFrame(p, "hook")} />;
      })}
    </div>
  );
}

export function CtaThumb() {
  return <Thumb project={sampleProject} frame={focusFrame(sampleProject, "cta", "c2")} />;
}
