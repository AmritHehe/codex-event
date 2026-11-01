import { redirect } from "next/navigation";

// Phase 3 turns this into the "paste your URL" entry point.
export default function Home() {
  redirect("/studio");
}
