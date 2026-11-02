import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AGENTS } from "@/distribution/agents";
import { CHANNELS } from "@/distribution/channels";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";

/** Editorial index of the distribution team. Static on purpose: a calm beat between two pinned scenes. */
export function Agents() {
  return (
    <section id="agents" data-scene="Agents" className="border-t border-line px-4 pt-24 pb-28 md:px-8 md:pt-36 md:pb-40">
      <div className="mx-auto max-w-[1376px]">
        <div className="grid gap-6 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7">
            <p className={`${LABEL} mb-4`}>04 Agents</p>
            <h2 className="text-[clamp(36px,5.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.055em]">
              {AGENTS.length} workflows for your&nbsp;agent.
            </h2>
          </div>
          <p className="max-w-[44ch] self-end text-[16px] leading-[1.55] text-muted md:col-span-4 md:col-start-9 md:text-[17px]">
            Connect your own agent and use these workflow guides to prepare launch assets. Review every draft; publishing is available only through the destinations listed in Connections.
          </p>
        </div>

        <ol className="mt-14 border-t border-ink md:mt-20">
          {AGENTS.map((a, i) => {
            const n = CHANNELS.filter((c) => c.agent === a.id).length;
            return (
              <li
                key={a.id}
                className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-line py-5 transition-colors hover:bg-panel md:grid-cols-[72px_minmax(0,5fr)_minmax(0,6fr)_120px] md:gap-x-8 md:py-7"
              >
                <span className="font-mono text-[11px] tracking-[0.08em] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[clamp(22px,2.5vw,40px)] leading-none font-semibold tracking-[-0.045em] transition-transform duration-300 ease-[var(--ease-out)] md:group-hover:translate-x-2">
                  {a.name.replace(/ agent$/, "")}
                </h3>
                <span className={`${LABEL} text-right tabular-nums md:order-last`}>
                  {n} {n === 1 ? "channel" : "channels"}
                </span>
                <p className="col-start-2 col-end-4 text-[15px] leading-[1.5] text-muted md:col-start-auto md:col-end-auto md:text-[17px]">{a.role}</p>
              </li>
            );
          })}
        </ol>

        <Link
          href="/distribution"
          className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
        >
          See all {CHANNELS.length} channels and their rules
          <ArrowRightIcon size={15} weight="bold" className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
