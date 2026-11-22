'use client'

import type { SeoAssistantRow } from '@commerce/core/seo-assistant'
import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { seoAssistantContent } from '@/data/seo-assistant'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SeoOpportunityRowProps = {
  row: SeoAssistantRow
  selected: boolean
  /** Ticking is allowed (AI on, the member may edit it, the selection has room). */
  selectable: boolean
  /** "Fix with AI" is allowed for this row. */
  canFix: boolean
  onSelect: (on: boolean) => void
  onFix: () => void
}

/** Gaps listed before "+n more". */
const GAPS_SHOWN = 3

const number = (n: number) => n.toLocaleString('en-IN')

function editHref(row: SeoAssistantRow): string {
  if (row.resource === 'product') return `${routes.products.detail(row.id)}?tab=seo`
  if (row.resource === 'collection') return routes.products.collection(row.id)
  return `${routes.onlineStore.page(row.id)}?from=seo&focus=page-seo-title`
}

/** One item Google shows: its numbers, top searches, current listing and gaps. */
export default function SeoOpportunityRow({
  row,
  selected,
  selectable,
  canFix,
  onSelect,
  onFix,
}: SeoOpportunityRowProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.list)
  const kinds = useCopy(seoReportContent.kinds)

  // Render logic
  const shownGaps = row.gaps.slice(0, GAPS_SHOWN)
  const extraGaps = row.gaps.length - shownGaps.length
  const checkboxId = `seo-row-${row.resource}-${row.id}`
  const stats = [
    { label: copy.impressions, value: number(row.current.impressions) },
    { label: copy.clicks, value: number(row.current.clicks) },
    { label: copy.position, value: row.current.position.toFixed(1) },
  ]

  return (
    <li className="flex flex-col gap-3 px-3 py-3 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <Checkbox
          id={checkboxId}
          aria-label={copy.select(row.title)}
          checked={selected}
          disabled={!selectable && !selected}
          onCheckedChange={(on) => onSelect(on === true)}
          className="mt-0.5"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={checkboxId} className="truncate text-body-strong text-ink-strong">
              {row.title}
            </label>
            <StatusChip dot={false}>{copy.resource[row.resource]}</StatusChip>
            {row.inBand ? <StatusChip tone="info">{copy.filters.band}</StatusChip> : null}
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dt className="text-caption text-muted-foreground">{s.label}</dt>
                <dd className="text-body font-medium tabular-nums text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.topSearches}</span>
            {row.queries.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {row.queries.map((q) => (
                  <li key={q.query}>
                    <StatusChip dot={false} variant="outline">
                      {q.query} · {number(q.impressions)}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-body text-muted-foreground">{copy.noSearches}</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-caption text-muted-foreground">{copy.current}</span>
            <span className="text-body text-foreground">{row.seoTitle || copy.noSeoTitle}</span>
            <span className="text-body text-muted-foreground">
              {row.seoDescription || copy.noSeoDescription}
            </span>
          </div>
          {shownGaps.length ? (
            <ul className="flex flex-col gap-0.5">
              {shownGaps.map((g, i) => (
                <li key={g} className="text-caption text-muted-foreground">
                  {kinds[g](row.gapDetails[i] ?? null)}
                </li>
              ))}
              {extraGaps > 0 ? (
                <li className="text-caption text-muted-foreground">{copy.moreGaps(extraGaps)}</li>
              ) : null}
            </ul>
          ) : (
            <span className="text-caption text-muted-foreground">{copy.noGaps}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 md:flex-col md:items-end">
        <Button variant="outline" size="sm" disabled={!canFix} onClick={onFix}>
          <AiIcon className="size-4" />
          {copy.fix}
        </Button>
        <Button variant="ghost" size="sm" render={<Link href={editHref(row)} />}>
          {copy.edit}
        </Button>
      </div>
    </li>
  )
}
