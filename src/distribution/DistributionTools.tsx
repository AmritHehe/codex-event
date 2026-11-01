"use client";
import { useEffect, useReducer, useState } from "react";
import { sampleProject } from "@/video/sample";
import { projectSchema, type Project } from "@/video/schema";
import { CommunityQueue } from "./CommunityQueue";
import { MemeAgent } from "./MemeAgent";
import { Publisher } from "./Publisher";

const tabs = ["Publish", "Meme", "Community"] as const;
export function DistributionTools() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Publish");
  const [project, setProject] = useReducer((_old: Project, next: Project) => next, sampleProject);
  const [saved, setSaved] = useReducer(() => true, false);
  useEffect(() => {
    try { const raw = localStorage.getItem("shipcast:project"); if (raw) { setProject(projectSchema.parse(JSON.parse(raw))); setSaved(); } }
    catch { /* use the explicitly labelled sample */ }
  }, []);
  return (
    <section aria-labelledby="distribution-tools" className="mb-10 border-y border-line py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="distribution-tools" className="text-[24px] font-semibold tracking-tight">Launch workspace</h2>
        <p className="text-[12px] text-muted">{saved ? "Project" : "Sample project"}: {project.name}</p>
      </div>
      <div role="tablist" aria-label="Distribution tools" className="flex gap-1 border-b border-line">
        {tabs.map((name, index) => <button key={name} id={`tool-${name}`} role="tab" tabIndex={tab === name ? 0 : -1} aria-selected={tab === name} aria-controls={`panel-${name}`} onClick={() => setTab(name)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next !== null) { event.preventDefault(); setTab(tabs[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next].focus(); }
        }} className={`press border-b-2 px-4 py-2 text-[13px] ${tab === name ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>{name}</button>)}
      </div>
      {tabs.map((name) => <div key={name} role="tabpanel" hidden={tab !== name} id={`panel-${name}`} aria-labelledby={`tool-${name}`}>
        {name === "Publish" ? <Publisher /> : name === "Meme" ? <MemeAgent project={project} /> : <CommunityQueue project={project} />}
      </div>)}
    </section>
  );
}
