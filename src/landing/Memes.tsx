import Image from "next/image";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";

// Generated with the Codex CLI image tool; the caption text is baked into each PNG, alt repeats it.
const MEMES = [
  { src: "/memes/meme-1.png", alt: "Meme: a developer bows on stage beside a polished dashboard to an empty theater with one moth. Caption: Spent 6 months on the UI. My only user is me.", span: "md:col-span-4 md:row-span-2" },
  { src: "/memes/meme-2.png", alt: "Meme: a panicked developer in a party hat stares at a flat analytics chart. Caption: Launch day. One visitor. It's my mom.", span: "md:col-span-2" },
  { src: "/memes/meme-3.png", alt: "Meme: an exhausted developer buried in paper posts beside endless mail slots. Caption: Built it in a weekend. Posting it to 66 channels until retirement.", span: "md:col-span-2" },
  { src: "/memes/meme-4.png", alt: "Meme: a developer sleeps while a friendly robot sends glowing paper planes over the city. Caption: I went to bed. My AI agent went to market.", span: "md:col-span-3" },
  { src: "/memes/meme-5.png", alt: "Meme: a developer with a megaphone on a finished bridge that stops short of a crowd across a canyon. Caption: Building is solved. Distribution isn't.", span: "md:col-span-3" },
];

/** Proof of the meme agent: real output, framed like a contact sheet. */
export function Memes() {
  return (
    <section id="memes" data-scene="Memes" className="border-t border-line px-4 pt-24 pb-28 md:px-8 md:pt-36 md:pb-40">
      <div className="mx-auto max-w-[1376px]">
        <div className="grid gap-6 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7">
            <p className={`${LABEL} mb-4`}>Memes</p>
            <h2 className="text-[clamp(36px,5.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.055em]">Made by your&nbsp;agent.</h2>
          </div>
          <p className="max-w-[44ch] self-end text-[16px] leading-[1.55] text-muted md:col-span-4 md:col-start-9 md:text-[17px]">
            Every launch kit ships with memes about your product. These ones are about ours, generated end to end with the Codex CLI.
          </p>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 md:mt-20 md:grid-cols-6">
          {MEMES.map((m, i) => (
            <li key={m.src} className={`group flex flex-col bg-canvas p-3 md:p-4 ${m.span}`}>
              <div className="relative aspect-square flex-1 overflow-hidden transition-transform duration-300 ease-[var(--ease-out)] group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                <Image src={m.src} alt={m.alt} fill sizes="(min-width: 768px) 60vw, 100vw" className="object-cover" />
              </div>
              <p className={`${LABEL} mt-3 tabular-nums`}>MEME {String(i + 1).padStart(2, "0")} · CODEX CLI</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
