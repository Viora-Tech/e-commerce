'use client'

import type { SegmentRules } from '@commerce/core/segments'
import { ArrowRight } from '@commerce/ui/icons'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type TemplateId = keyof typeof segmentsContent.templates.items

type SegmentTemplatesProps = {
  /** Names of saved segments; a template already saved under its name is left out. */
  savedNames: string[]
}

/** Each template's rules. Spend is paise, like the builder saves it. */
const TEMPLATE_RULES: Record<TemplateId, SegmentRules> = {
  topSpenders: { match: 'all', conditions: [{ field: 'spend', op: 'gte', value: '1000000' }] },
  repeatBuyers: { match: 'all', conditions: [{ field: 'orders', op: 'gte', value: '2' }] },
  oneTimeBuyers: { match: 'all', conditions: [{ field: 'orders', op: 'eq', value: '1' }] },
  recentBuyers: {
    match: 'all',
    conditions: [{ field: 'last_order_days', op: 'lte', value: '30' }],
  },
  lapsed: { match: 'all', conditions: [{ field: 'last_order_days', op: 'gte', value: '90' }] },
  slippingVips: {
    match: 'all',
    conditions: [
      { field: 'spend', op: 'gte', value: '500000' },
      { field: 'last_order_days', op: 'gte', value: '60' },
    ],
  },
  subscribed: { match: 'all', conditions: [{ field: 'marketing', op: 'eq', value: 'true' }] },
  business: { match: 'all', conditions: [{ field: 'business', op: 'eq', value: 'true' }] },
}

function templateHref(name: string, rules: SegmentRules): string {
  const query = new URLSearchParams({ name, rules: JSON.stringify(rules) })
  return `${routes.customers.newSegment()}?${query}`
}

/** Ready-made segments that open the builder prefilled, so sellers learn what a segment can be. */
export default function SegmentTemplates({ savedNames }: SegmentTemplatesProps) {
  // Hooks
  const copy = useCopy(segmentsContent)

  // Render logic
  const saved = new Set(savedNames.map((n) => n.trim().toLowerCase()))
  const templates = (Object.keys(TEMPLATE_RULES) as TemplateId[])
    .map((id) => ({ id, ...copy.templates.items[id], rules: TEMPLATE_RULES[id] }))
    .filter((t) => !saved.has(t.name.toLowerCase()))

  if (templates.length === 0) return null

  return (
    <DataCard title={copy.templates.heading} subtitle={copy.templates.body}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link
            key={t.id}
            href={templateHref(t.name, t.rules)}
            className="group flex flex-col gap-1 rounded-lg border border-line p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between gap-2 text-body text-ink-strong">
              {t.name}
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
            <span className="text-caption text-muted-foreground">{t.description}</span>
          </Link>
        ))}
      </div>
    </DataCard>
  )
}
