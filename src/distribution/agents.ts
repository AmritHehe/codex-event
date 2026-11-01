// The distribution team: each channel is worked by exactly one agent.
export type AgentId = "video" | "copy" | "meme" | "community" | "launch" | "listing" | "search" | "registry" | "outreach";

export const AGENTS: { id: AgentId; name: string; role: string; does: string[] }[] = [
  {
    id: "video",
    name: "Video agent",
    role: "Cuts the launch video for every feed.",
    does: ["Re-renders 9:16, 1:1 and 16:9 from one project", "Writes hooks for the first 2 seconds", "Captions, cover frame and upload"],
  },
  {
    id: "copy",
    name: "Copy agent",
    role: "Threads, posts and captions in your voice.",
    does: ["Adapts one story to each platform's format", "Schedules for each audience's peak hours", "Drafts replies to comments"],
  },
  {
    id: "meme",
    name: "Meme agent",
    role: "Memes, carousels and UGC-style hooks.",
    does: ["Remixes trending formats with your product", "Builds carousel slides from features", "Writes creator briefs for UGC"],
  },
  {
    id: "community",
    name: "Community agent",
    role: "Finds conversations where your product helps.",
    does: ["Monitors Reddit, HN and Discord for intent", "Drafts helpful, rule-abiding replies", "You approve every post"],
  },
  {
    id: "launch",
    name: "Launch agent",
    role: "Runs launch day on the launch platforms.",
    does: ["Prepares gallery, tagline and maker comment", "Builds the hour-by-hour launch checklist", "Rallies your list without vote begging"],
  },
  {
    id: "listing",
    name: "Listing agent",
    role: "Gets you listed in directories and marketplaces.",
    does: ["Fills submission forms from one product profile", "Tracks approvals and backlinks", "Keeps listings updated on each release"],
  },
  {
    id: "search",
    name: "Search agent",
    role: "SEO and answer-engine content that gets cited.",
    does: ["Writes comparison and use-case pages", "Publishes llms.txt and structured data", "Tracks citations in AI assistants"],
  },
  {
    id: "registry",
    name: "Registry agent",
    role: "Puts your product where AI agents look for tools.",
    does: ["Packages an MCP server and listings", "Submits to agent registries and app directories", "Writes tool descriptions agents can pick"],
  },
  {
    id: "outreach",
    name: "Outreach agent",
    role: "Cold email, creators and partnerships.",
    does: ["Builds lead lists from your ideal customer", "Personalises first lines from public signals", "Follows up and books replies into your inbox"],
  },
];
