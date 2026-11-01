import type { Metadata } from "next";
import { Connect } from "@/connect/Connect";

export const metadata: Metadata = {
  title: "Connect your agent · Shipcast",
  description: "Connect Codex CLI, Claude Code or Gemini CLI to Shipcast. Your agent builds the launch film on your own plan while you watch.",
};

// Focused flow: no app rail, no landing chrome.
export default function ConnectPage() {
  return <Connect />;
}
