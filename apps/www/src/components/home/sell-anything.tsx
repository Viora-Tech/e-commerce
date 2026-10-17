import { Clock, Download, Package_ as Package, RefreshCw } from '@commerce/ui/icons'
import type { ComponentType } from 'react'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'
import SectionHeading from '../common/section-heading'

const copy = homeContent.sell

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  package: Package,
  subscriptions: RefreshCw,
  downloads: Download,
  services: Clock,
}

export default function SellAnything() {
  return (
    <section className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="bottom-0 left-1/2 h-72 w-[50rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-12 md:gap-16">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        <ul className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {copy.cards.map((card, index) => {
            const Icon = ICONS[card.icon] ?? Package
            return (
              <Reveal
                as="li"
                step={index}
                key={card.title}
                className="surface-card card-lift flex flex-col gap-3 rounded-3xl p-6"
              >
                <span className="mb-3 grid size-10 place-items-center rounded-xl border border-border bg-muted text-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.body}</p>
              </Reveal>
            )
          })}
        </ul>
      </PageContainer>
    </section>
  )
}
