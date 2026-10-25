import Image from 'next/image'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'

const copy = homeContent.proof

/** The first store on the platform, stated as a fact with a link to it. No quote until Waimers gives one. */
export default function Proof() {
  return (
    <section className="relative isolate overflow-hidden py-16 md:py-24">
      <AmbientLight className="top-1/4 left-1/2 h-64 w-[56rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-8">
        <p className="text-eyebrow">{copy.eyebrow}</p>
        <Reveal
          as="div"
          className="glass-panel flex w-full max-w-2xl flex-col items-center gap-5 rounded-3xl px-6 py-10 text-center md:px-12"
        >
          <Image
            src="/brand/waimers/logo-on-dark.png"
            alt={copy.name}
            width={96}
            height={25}
            className="h-8 w-auto"
          />
          <p className="text-2xl font-medium text-balance text-foreground md:text-3xl">
            {copy.live}{' '}
            <a
              href={copy.href}
              className="underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
            >
              {copy.domain}
            </a>
          </p>
          <p className="text-sm text-muted-foreground">{copy.meta}</p>
        </Reveal>
      </PageContainer>
    </section>
  )
}
