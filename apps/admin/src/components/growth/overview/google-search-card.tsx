'use client'

import { percentChange, SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import VisitorListCard from '@/components/analytics/visitor-list-card'
import StatStrip from '@/components/layout/stat-strip'
import { growthHomeContent } from '@/data/growth-home'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type SearchSummary = Awaited<ReturnType<typeof api.marketing.searchSummary>>

type GoogleSearchCardProps = { summary: SearchSummary }

/** Where each unfinished setup step sends the merchant. */
function setupHref(state: Exclude<SearchSummary['state'], 'ready'>): string {
  if (state === 'not-installed') return routes.apps.install(SEARCH_CONSOLE_APP_ID)
  if (state === 'pending') return routes.apps.page(SEARCH_CONSOLE_APP_ID)
  return routes.apps.settings(SEARCH_CONSOLE_APP_ID)
}

/**
 * Growth's Google Search card (#1022): how the store does in Google search, from the Search
 * Console app's stored numbers (the latest 28 days against the 28 before) with the top
 * searches, or the setup step that is missing. The page's range picker does not apply: Google's
 * numbers come in 28-day windows about three days behind, so the card says which days it shows.
 */
export default function GoogleSearchCard({ summary }: GoogleSearchCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.google)
  const sc = useCopy(searchConsoleContent)
  const fmt = useFormat()

  // Render logic
  const k = sc.overview.kpis
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-col">
        <h2 className="text-body-strong text-foreground">{copy.title}</h2>
        <p className="text-caption text-muted-foreground">
          {summary.state === 'ready' ? copy.window(summary.days) : copy.summary}
        </p>
      </div>
      {summary.state === 'ready' ? (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={routes.apps.page(SEARCH_CONSOLE_APP_ID)} />}
          nativeButton={false}
        >
          {copy.open}
        </Button>
      ) : null}
    </div>
  )

  if (summary.state !== 'ready') {
    const step = copy.setup[summary.state]
    return (
      <section className="flex flex-col gap-3">
        {header}
        <Card inset="none" gap="none">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-body text-muted-foreground">{step.body}</p>
            <Button
              variant="outline"
              render={<Link href={setupHref(summary.state)} />}
              nativeButton={false}
            >
              {step.action}
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  const now = summary.totals.current
  const before = summary.totals.previous
  return (
    <section className="flex flex-col gap-3">
      {header}
      <StatStrip
        tiles={[
          {
            id: 'clicks',
            label: k.clicks,
            value: fmt.number(now.clicks),
            trend: summary.clickChange,
            trendNote: k.vsBefore,
          },
          {
            id: 'views',
            label: k.views,
            value: fmt.number(now.impressions),
            trend: summary.impressionChange,
            trendNote: k.vsBefore,
          },
          {
            id: 'ctr',
            label: k.ctr,
            value: formatRate(now.ctr),
            trend: percentChange(now.ctr, before.ctr),
            trendNote: k.vsBefore,
          },
          {
            id: 'position',
            label: k.position,
            value: now.position.toFixed(1),
            trend: percentChange(now.position, before.position),
            trendNote: k.vsBefore,
            note: k.positionNote,
            invert: true,
          },
        ]}
      />
      <VisitorListCard
        title={sc.overview.topSearches}
        empty={sc.overview.empty}
        action={
          <Link
            href={routes.apps.page(SEARCH_CONSOLE_APP_ID, 'searches')}
            className="text-caption text-muted-foreground underline underline-offset-2"
          >
            {sc.overview.seeAll}
          </Link>
        }
        rows={summary.queries.map((q) => ({
          key: q.key,
          label: q.key,
          count: q.current.clicks,
          share: now.clicks > 0 ? q.current.clicks / now.clicks : 0,
        }))}
      />
    </section>
  )
}
