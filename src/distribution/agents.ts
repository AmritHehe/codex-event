// Workflow categories for the user’s connected agent; these are not independent background workers.
export type AgentId = "video" | "copy" | "meme" | "community" | "launch" | "listing" | "search" | "registry" | "outreach";

export const AGENTS: { id: AgentId; name: string; role: string; does: string[] }[] = [
  {
    id: "video",
    name: "Video agent",
    role: "Cuts the launch video for every feed.",
    does: ["Re-renders 9:16, 1:1 and 16:9 from one project", "Writes hooks for the first 2 seconds", "Export MP4 and review publishing options"],
  },
  {
    id: "copy",
    name: "Copy agent",
    role: "Threads, posts and captions in your voice.",
    does: ["Adapts one story to each platform's format", "Choose a schedule on supported aggregator destinations", "Review generated drafts before posting"],
  },
  {
    id: "meme",
    name: "Meme agent",
    role: "Memes, carousels and UGC-style hooks.",
    does: ["Remixes trending formats with your product", "Prepare visual ideas from product features", "Use the channel guide to prepare creator briefs"],
  },
  {
    id: "community",
    name: "Community agent",
    role: "Prepares community drafts for your review.",
    does: ["Use destination guides to find relevant conversations", "Prepare a draft or manual-only checklist", "You approve every post"],
  },
  {
    id: "launch",
    name: "Launch agent",
    role: "Helps prepare your launch-day copy.",
    does: ["Draft a tagline and maker introduction", "Use the destination preparation guide", "Review and publish manually where required"],
  },
  {
    id: "listing",
    name: "Listing agent",
    role: "Prepares directory and marketplace copy.",
    does: ["Draft listing copy from the product profile", "Open the destination and track approvals yourself", "Review listings when your product changes"],
  },
  {
    id: "search",
    name: "Search agent",
    role: "Prepares search-focused content drafts.",
    does: ["Writes comparison and use-case pages", "Use the channel guide for site metadata", "Review sources and verify claims before publishing"],
  },
  {
    id: "registry",
    name: "Registry agent",
    role: "Prepares copy for agent and tool directories.",
    does: ["Use the channel guide to prepare an MCP listing", "Submit listings through the destination yourself", "Draft clear product and tool descriptions"],
  },
  {
    id: "outreach",
    name: "Outreach agent",
    role: "Cold email, creators and partnerships.",
    does: ["Use destination guides to plan outreach", "Draft copy from your product context", "Review recipients and send outreach yourself"],
  },
];
