'use client'

import { BarChart3, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import EmptyState from '@/components/layout/empty-state'
import SectionHead from '@/components/layout/section-head'
import StatTile from '@/components/layout/stat-tile'
import { analyticsContent } from '@/data/analytics'
import { umamiContent } from '@/data/umami'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatDay, formatRate, type RangeState } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { INTL_LOCALE } from '@/lib/i18n'
import { formatCompact } from '@/lib/money'
import { routes } from '@/lib/routes'
import VisitorListCard, { type VisitorListRow } from './visitor-list-card'

type VisitorsSectionProps = { range: RangeState }

type ReportView = Awaited<ReturnType<typeof api.umami.report>>
type Ready = Extract<ReportView, { state: 'ready' }>
type Kpi = Ready['report']['kpis'][number]
type Breakdown = keyof Ready['report']['breakdowns']
type Row = Ready['report']['breakdowns'][Breakdown][number]

type Copy = (typeof umamiContent)['visitors']

const LISTS: readonly Breakdown[] = [
  'pages',
  'referrers',
  'campaigns',
  'countries',
  'devices',
  'browsers',
]

/** What a row's label needs: the copy, and country names in the member's language. */
type Labels = { copy: Copy; regions: Intl.DisplayNames }

function countryName(regions: Intl.DisplayNames, code: string): string {
  try {
    return regions.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** A row's label as merchants read it: country names, plain device words, Umami's empty bucket named. */
function rowLabel({ copy, regions }: Labels, list: Breakdown, label: string | null): string {
  if (label === null) return copy.lists[list].none
  if (list === 'countries') return countryName(regions, label)
  if (list === 'devices') return (copy.devices as Record<string, string>)[label] ?? label
  return label
}

function toListRows(labels: Labels, list: Breakdown, rows: Row[]): VisitorListRow[] {
  return rows.map((r, i) => ({
    key: `${r.label ?? ''}-${i}`,
    label: rowLabel(labels, list, r.label),
    count: r.count,
    share: r.share,
  }))
}

function formatKpi(copy: Copy, kpi: Kpi): string {
  if (kpi.id === 'bounceRate') return formatRate(kpi.value)
  if (kpi.id === 'visitDuration') return copy.seconds(kpi.value)
  return formatCompact(kpi.value)
}

const trendOf = (kpi: Kpi) => (kpi.delta === null ? null : Math.round(kpi.delta * 1000) / 10)

/**
 * The Analytics page's visitor section, from the Umami app: visitor figures, visitors and page
 * views per day, then top pages, referrers, UTM campaigns, countries, devices and browsers.
 * Follows the page's range. Without the app, or before it is connected, it shows how to set
 * it up; when Umami cannot be reached it says so and the rest of the page is unaffected.
 */
export default function VisitorsSection({ range }: VisitorsSectionProps) {
  // Hooks
  const umami = useCopy(umamiContent)
  const analytics = useCopy(analyticsContent)
  const locale = useLocale()
  const [view, setView] = useState<ReportView | null>(null)

  useEffect(() => {
    let live = true
    setView(null)
    api.umami
      .report({ range })
      .then((next) => {
        if (live) setView(next)
      })
      .catch((err: unknown) => {
        if (live) {
          setView({
            state: 'error',
            message: err instanceof Error ? err.message : '',
          })
        }
      })
    return () => {
      live = false
    }
  }, [range])

  // Early returns
  const copy = umami.visitors
  const heading = <SectionHead title={copy.title} intro={copy.intro} />
  if (view === null) {
    return (
      <section aria-label={copy.title} aria-busy className="flex flex-col gap-4">
        {heading}
        <Skeleton className="h-64 w-full rounded-xl" />
        <span className="sr-only">{copy.loading}</span>
      </section>
    )
  }
  if (view.state !== 'ready') {
    const empty =
      view.state === 'not-installed'
        ? { ...copy.empty.notInstalled, href: routes.apps.list() }
        : view.state === 'not-connected'
          ? { ...copy.empty.notConnected, href: routes.apps.page('umami') }
          : {
              title: copy.empty.error.title,
              body: view.message || umami.failed,
              action: copy.empty.error.action,
              href: routes.apps.page('umami'),
            }
    return (
      <section aria-label={copy.title} className="flex flex-col gap-4">
        {heading}
        <Card inset="y-10">
          <EmptyState
            heading={empty.title}
            body={empty.body}
            icon={BarChart3}
            action={
              <Button variant="outline" nativeButton={false} render={<Link href={empty.href} />}>
                {empty.action}
              </Button>
            }
          />
        </Card>
      </section>
    )
  }

  // Render logic
  const labels: Labels = {
    copy,
    regions: new Intl.DisplayNames([INTL_LOCALE[locale]], { type: 'region' }),
  }
  const { report } = view
  const days = view.range.days
  const visitorPoints = days.map((d, i) => ({
    label: formatDay(d),
    value: report.visitors[i] ?? 0,
  }))
  const pageviewPoints = days.map((d, i) => ({
    label: formatDay(d),
    value: report.pageviews[i] ?? 0,
  }))
  const totalVisitors = report.kpis.find((k) => k.id === 'visitors')?.value ?? 0

  return (
    <section aria-label={copy.title} className="flex flex-col gap-4">
      <SectionHead
        title={copy.title}
        intro={copy.intro}
        action={
          <Button
            variant="key-neutral"
            nativeButton={false}
            render={<a href={view.dashboardUrl} target="_blank" rel="noopener noreferrer" />}
          >
            {copy.open}
            <ExternalLink aria-hidden data-icon="inline-end" />
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {report.kpis.map((kpi) => (
          <StatTile
            key={kpi.id}
            label={copy.kpis[kpi.id]}
            value={formatKpi(copy, kpi)}
            trend={trendOf(kpi)}
            trendNote={analytics.compare}
            invert={kpi.id === 'bounceRate'}
          />
        ))}
      </div>
      <ChartCard
        title={copy.trend.title}
        subtitle={copy.trend.subtitle(
          formatCompact(totalVisitors),
          analytics.salesOverTime.spans[view.range.key as RangeState['key']] ?? '',
        )}
        periods={[
          { id: 'visitors', label: copy.trend.visitors, data: visitorPoints },
          { id: 'pageviews', label: copy.trend.pageviews, data: pageviewPoints },
        ]}
        seriesKey={`visitors-${view.range.from}-${view.range.to}`}
        seriesLabel={copy.trend.count}
        formatValue={formatCompact}
      />
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {LISTS.map((list) => (
          <VisitorListCard
            key={list}
            title={copy.lists[list].title}
            rows={toListRows(labels, list, report.breakdowns[list])}
            empty={copy.lists[list].empty}
          />
        ))}
      </div>
    </section>
  )
}
