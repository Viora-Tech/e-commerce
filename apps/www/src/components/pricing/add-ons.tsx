import {
  AiIcon,
  Phone_ as Phone,
  Users_ as Users,
  WhatsappLogo_ as WhatsappLogo,
} from '@commerce/ui/icons'
import type { ComponentType } from 'react'
import { pricingContent } from '@/data/pricing'
import IconBadge from '../common/icon-badge'
import PageContainer from '../common/page-container'
import Reveal from '../common/reveal'
import SectionHeading from '../common/section-heading'

const copy = pricingContent.page.addOns

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  ai: AiIcon,
  whatsapp: WhatsappLogo,
  seat: Users,
}

export default function AddOns() {
  return (
    <PageContainer as="section" className="flex flex-col items-center gap-10 py-16 md:py-24">
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} size="subsection" />
      <ul className="grid w-full gap-6 md:grid-cols-3">
        {copy.items.map((item, index) => {
          const Icon = ICONS[item.icon] ?? Phone
          return (
            <Reveal
              as="li"
              spotlight
              step={index}
              key={item.title}
              className="surface-card group flex flex-col gap-4 rounded-3xl p-6"
            >
              <IconBadge className="mb-0">
                <Icon aria-hidden className="size-5" />
              </IconBadge>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </div>
              <p className="mt-auto text-sm font-medium text-foreground">{item.price}</p>
            </Reveal>
          )
        })}
      </ul>
    </PageContainer>
  )
}
