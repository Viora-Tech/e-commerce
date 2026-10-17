import { homeContent } from '@/data/home'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'

const copy = homeContent.integrations

/** An endless, pausable strip of the payment, courier and channel names the platform connects to. */
export default function IntegrationsMarquee() {
  return (
    <PageContainer as="section" className="py-12 md:py-16">
      <Reveal className="flex flex-col items-center gap-6">
        <p className="text-eyebrow">{copy.eyebrow}</p>
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="animate-marquee flex w-max gap-4 py-1 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center">
            {[0, 1]
              .flatMap((round) => copy.items.map((name) => ({ name, round })))
              .map(({ name, round }) => (
                <li
                  // The list repeats once so the loop is seamless; the copy is hidden from readers.
                  key={`${round}-${name}`}
                  aria-hidden={round === 1 ? true : undefined}
                  className="glass-panel flex shrink-0 items-center gap-3 rounded-full py-2 pr-5 pl-2 text-sm font-medium text-foreground motion-reduce:[&:nth-child(n+10)]:hidden"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {name.charAt(0)}
                  </span>
                  {name}
                </li>
              ))}
          </ul>
        </div>
      </Reveal>
    </PageContainer>
  )
}
