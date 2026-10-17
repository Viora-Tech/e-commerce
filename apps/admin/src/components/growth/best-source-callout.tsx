'use client'

import type { SourceRow } from '@commerce/api'
import KeyValueList from '@/components/layout/key-value-list'
import { growthOverviewContent, SOURCE_LABELS } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import SourceIcon from './source-icon'

type BestSourceCalloutProps = { source: SourceRow }

/** Figma Growth (658:64823) "Best source" card: the source that sold most, with its numbers. */
export default function BestSourceCallout({ source }: BestSourceCalloutProps) {
  // Hooks
  const { bestSource: copy } = useCopy(growthOverviewContent)
  const fmt = useFormat()

  // Render logic
  const title = copy.title.replace('{source}', SOURCE_LABELS[source.source])

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border">
        <SourceIcon source={source.source} className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {copy.eyebrow}
        </p>
        <p className="text-card-title text-ink-strong">{title}</p>
        <p className="text-caption text-muted-foreground">{copy.body}</p>
      </div>
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.sales, value: fmt.money(source.salesPaise) },
          { label: copy.orders, value: fmt.number(source.orders) },
          {
            label: copy.conversion,
            value: source.sessions > 0 ? formatRate(source.conversion) : '',
          },
        ]}
      />
    </section>
  )
}
