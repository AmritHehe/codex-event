import type { Metadata } from "next";
import { Hub } from "@/distribution/Hub";

export const metadata: Metadata = { title: "Distribution · Shipcast" };

export default function DistributionPage() {
  return <Hub />;
}
