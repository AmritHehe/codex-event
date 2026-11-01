import { Preview } from "@/components/Preview";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Shipcast</h1>
        <p className="text-sm text-white/50">Video as code — every layer editable.</p>
      </header>
      <Preview />
    </main>
  );
}
