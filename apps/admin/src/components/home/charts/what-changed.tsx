'use client'

import type { DashboardChartsData } from '@commerce/api'
import { formatPercent } from '@commerce/money'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { homeSectionsContent } from '@/data/home-sections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { INTL_LOCALE } from '@/lib/i18n'

type WhatChangedProps = {
  data: DashboardChartsData
  loading: boolean
  /** Products running low right now (the Restock to-do's count). */
  lowStock: number
  /** Days in a row with a sale, up to today. */
  streakDays: number
}

type Line = { key: string; lead: string; rest: string }

type Copy = (typeof homeSectionsContent)['doing']

/** Below this change (2%) sales read "about the same". */
const FLAT = 0.02

const sum = (values: readonly number[]) => values.reduce((n, v) => n + v, 0)

/** Every line names the period it covers: the picked range, "right now" or "the last N days". */
function buildLines(
  props: WhatChangedProps,
  c: Copy,
  money: (paise: number) => string,
  pct: (fraction: number) => string,
): Line[] {
  const { data } = props
  const n = data.range
  const lines: Line[] = []
  const sales = sum(data.salesPaise)
  const before = data.previousSalesPaise ? sum(data.previousSalesPaise) : null
  if (sales > 0 || (before ?? 0) > 0) {
    let rest = c.salesNoBefore
    if (before !== null && before > 0) {
      const change = (sales - before) / before
      if (change > FLAT) rest = c.salesUp(pct(change), money(before), n)
      else if (change < -FLAT) rest = c.salesDown(pct(-change), money(before), n)
      else rest = c.salesFlat(money(before), n)
    }
    lines.push({ key: 'sales', lead: c.salesLead(n, money(sales)), rest })
  }
  // `topProducts` is ranked by sales; the most units comes from the same five.
  const best = data.topProducts[0]
  if (best) {
    const most = data.topProducts.reduce((a, b) => (b.units > a.units ? b : a), best)
    const rest = `${c.best(best.title, money(best.revenuePaise))} ${c.mostUnits(most.title, most.units)}`
    lines.push({ key: 'best', lead: c.bestLead(n), rest })
  }
  if (props.lowStock > 0) {
    const low = props.lowStock
    lines.push({ key: 'stock', lead: c.lowStockLead(low), rest: c.lowStock(low) })
  }
  if (props.streakDays > 1) {
    lines.push({ key: 'streak', lead: c.streakLead, rest: c.streak(props.streakDays) })
  }
  return lines
}

/**
 * "What changed" at the top of How you're doing: a few plain sentences from real numbers,
 * each saying its period. Sales and the best seller follow the 7/30/90 switch; the best
 * seller is by sales and also names the most units sold.
 */
export default function WhatChanged(props: WhatChangedProps) {
  // Hooks
  const c = useCopy(homeSectionsContent).doing
  const fmt = useFormat()

  // Render logic
  const pct = (fraction: number) => formatPercent(fraction, { locale: INTL_LOCALE[fmt.locale] })
  const lines = buildLines(props, c, fmt.moneyWhole, pct)

  return (
    <DataCard title={c.whatChanged}>
      {props.loading ? (
        <Skeleton className="h-24 w-full" />
      ) : lines.length === 0 ? (
        <EmptyState variant="inline" body={c.noData} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lines.map((line) => (
            <li key={line.key} className="flex items-start gap-2.5 text-body">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
              />
              <p className="text-muted-foreground">
                <span className="font-semibold text-ink-strong">{line.lead}</span> {line.rest}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
