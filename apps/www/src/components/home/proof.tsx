import Image from 'next/image'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'

const copy = homeContent.proof

/** Customer quote. PLACEHOLDER text until Waimers gives a real line. */
export default function Proof() {
  return (
    <section className="relative isolate overflow-hidden py-16 md:py-24">
      <AmbientLight className="top-1/4 left-1/2 h-64 w-[56rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-8">
        <p className="text-eyebrow">{copy.eyebrow}</p>
        <Reveal
          as="figure"
          className="glass-panel flex w-full max-w-4xl flex-col items-center gap-8 rounded-3xl px-6 py-10 text-center md:px-12 md:py-12"
        >
          <blockquote className="text-2xl font-medium text-balance text-foreground md:text-3xl">
            {copy.quote}
          </blockquote>
          <figcaption className="flex items-center gap-3 text-left">
            <Image
              src="/brand/waimers/logo-on-dark.png"
              alt=""
              width={96}
              height={25}
              className="h-6 w-auto"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{copy.name}</span>
              <span className="block text-xs text-muted-foreground">{copy.meta}</span>
            </span>
          </figcaption>
        </Reveal>
      </PageContainer>
    </section>
  )
}
