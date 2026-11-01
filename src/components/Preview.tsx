"use client";

import { Player } from "@remotion/player";
import { useState } from "react";
import { LaunchVideo } from "@/video/LaunchVideo";
import { sampleProject } from "@/video/sample";
import { ASPECTS, FPS, projectDuration, type Aspect } from "@/video/schema";

export function Preview() {
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const project = { ...sampleProject, aspect };
  const { width, height } = ASPECTS[aspect];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex gap-1 rounded-full bg-white/5 p-1 text-sm">
        {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
          <button
            key={a}
            onClick={() => setAspect(a)}
            className={`rounded-full px-4 py-1.5 transition ${a === aspect ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="w-full overflow-hidden rounded-xl ring-1 ring-white/10" style={{ aspectRatio: `${width} / ${height}`, maxHeight: "72vh", maxWidth: `calc(72vh * ${width / height})` }}>
        <Player
          component={LaunchVideo}
          inputProps={{ project }}
          durationInFrames={projectDuration(project)}
          compositionWidth={width}
          compositionHeight={height}
          fps={FPS}
          style={{ width: "100%", height: "100%" }}
          controls
          loop
          autoPlay
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  );
}
