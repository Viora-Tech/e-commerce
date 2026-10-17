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
            <span aria-hidden className="size-9 rounded-full bg-muted ring-1 ring-border" />
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
