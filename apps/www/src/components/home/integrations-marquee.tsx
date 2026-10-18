import { homeContent } from '@/data/home'
import BrandLogo from '../common/brand-logo'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'

const copy = homeContent.integrations

/** An endless, pausable strip of the payment, courier and channel logos the platform connects to. */
export default function IntegrationsMarquee() {
  return (
    <PageContainer as="section" className="py-12 md:py-16">
      <Reveal className="flex flex-col items-center gap-6">
        <p className="text-eyebrow">{copy.eyebrow}</p>
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="animate-marquee flex w-max gap-4 py-1 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center">
            {[0, 1]
              .flatMap((round) => copy.items.map((brand) => ({ brand, round })))
              .map(({ brand, round }) => (
                <li
                  // The list repeats once so the loop is seamless; the copy is hidden from readers.
                  key={`${round}-${brand}`}
                  aria-hidden={round === 1 ? true : undefined}
                  className="group/logo glass-panel flex h-12 shrink-0 items-center rounded-full px-4 motion-reduce:[&:nth-child(n+13)]:hidden"
                >
                  <BrandLogo brand={brand} />
                </li>
              ))}
          </ul>
        </div>
      </Reveal>
    </PageContainer>
  )
}
