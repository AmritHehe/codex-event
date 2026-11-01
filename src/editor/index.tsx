"use client";

import dynamic from "next/dynamic";

// The editor is pure client state (Player, localStorage, pointer drag): skip SSR/prerender entirely.
export const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div className="h-dvh animate-pulse bg-canvas" />,
});
