import type { Metadata } from "next";
import { Dashboard } from "@/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard · Shipcast" };

export default function DashboardPage() {
  return <Dashboard />;
}
