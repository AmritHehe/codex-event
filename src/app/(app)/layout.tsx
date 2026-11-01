import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <AppNav />
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
