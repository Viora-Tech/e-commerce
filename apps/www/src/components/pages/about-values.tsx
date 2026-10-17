import { AiIcon, CircleCheck, FieldText, Globe, Store } from '@commerce/ui/icons'
import type { ComponentType } from 'react'
import { aboutContent as copy } from '@/data/about'
import IconBadge from '../common/icon-badge'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'
import SectionHeading from '../common/section-heading'

const VALUE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  plain: FieldText,
  approve: CircleCheck,
  india: Globe,
  anything: Store,
}

export default function AboutValues() {
  return (
    <PageContainer as="section" className="flex flex-col items-center gap-12 py-20 md:py-28">
      <SectionHeading eyebrow={copy.values.eyebrow} title={copy.values.title} />
      <ul className="grid w-full gap-4 sm:grid-cols-2 lg:gap-6">
        {copy.values.items.map((item, index) => {
          const Icon = VALUE_ICONS[item.icon] ?? AiIcon
          return (
            <Reveal
              as="li"
              spotlight
              tilt={3}
              step={index % 2}
              key={item.title}
              className="surface-card group flex min-h-56 flex-col justify-end gap-3 rounded-3xl p-7"
            >
              <IconBadge className="mb-auto size-11">
                <Icon aria-hidden className="size-5" />
              </IconBadge>
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </Reveal>
          )
        })}
      </ul>
    </PageContainer>
  )
}
