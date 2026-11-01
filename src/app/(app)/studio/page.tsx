import type { Metadata } from "next";
import { Editor } from "@/editor";

export const metadata: Metadata = { title: "Studio · Shipcast" };

export default function StudioPage() {
  return <Editor />;
}
