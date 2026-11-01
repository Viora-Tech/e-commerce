'use client'

import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import RowMenu from '@/components/table/row-menu'
import { analyticsContent } from '@/data/analytics'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { rangeQuery } from '@/lib/analytics-range'
import { ANSWER_SLUG } from '@/lib/answer-report'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Saved = Awaited<ReturnType<typeof api.analytics.savedReports>>[number]

type SavedReportCardProps = {
  saved: Saved
  onRename: () => void
  onDelete: () => void
}

/** Figma "Saved reports" card bars: a quiet picture of a chart, the same for every card. */
const BARS = [100, 72, 64, 48, 36, 30, 24]

/**
 * One saved report (Figma "Reports home"): its name, the report and dates it runs, when it
 * was saved, and a ⋯ menu to rename or delete it. Opens the report with those dates.
 */
export default function SavedReportCard({ saved, onRename, onDelete }: SavedReportCardProps) {
  // Hooks
  const copy = useCopy(analyticsContent.reports.saved)
  const fmt = useFormat()

  // Render logic
  const r = saved.range
  /* A saved custom query opens in the query editor with its own text and dates; a saved AI
     answer opens its snapshot. */
  const href =
    saved.reportSlug === 'query'
      ? `${routes.analytics.query()}?saved=${saved.id}`
      : saved.reportSlug === ANSWER_SLUG
        ? `${routes.analytics.answer()}?saved=${saved.id}`
        : `${routes.analytics.report(saved.reportSlug)}${rangeQuery(r)}`
  const rangeLabel =
    r.key === 'custom'
      ? copy.ranges.custom(fmt.date(r.from ?? ''), fmt.date(r.to ?? ''))
      : copy.ranges[r.key]

  return (
    <Card className="relative h-full gap-3 p-5 motion-press hover:shadow-card-hover">
      <div aria-hidden className="flex h-10 items-end gap-1">
        {BARS.map((h, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, decorative set of bars.
            key={i}
            className="w-3 rounded-sm bg-primary/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Link href={href} className="text-body-strong text-foreground after:absolute after:inset-0">
          {saved.name}
        </Link>
        <p className="text-caption text-muted-foreground">
          {saved.reportTitle} · {rangeLabel}
        </p>
        <p className="text-caption text-muted-foreground">
          {copy.savedOn(fmt.day(saved.createdAt))}
        </p>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <RowMenu
          items={[
            { label: copy.menu.rename, onSelect: onRename },
            { label: copy.menu.delete, onSelect: onDelete, destructive: true },
          ]}
        />
      </div>
    </Card>
  )
}
