'use client'

import {
  type DiscoveryOverview,
  discoveryChange,
  discoveryRate,
  OVERVIEW_PERIODS,
  type SearchFunnel,
} from '@commerce/core/discovery'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import InlineState from '@/components/states/inline-state'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import RecommendationStatsTable from './recommendation-stats-table'
import SearchQueryTable from './search-query-table'

type Step = Exclude<keyof SearchFunnel, 'sessions'>

const STEPS: Step[] = ['clicked', 'added', 'checkedOut']

const DEFAULT_DAYS = 30

/**
 * The Search & discovery app's first page: the search funnel against the period before, top
 * searches, searches with no results and with no clicks (each with an "Add synonym" or "Pin a
 * product" shortcut), and how the recommendation rows do.
 */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const fmt = useFormat()
  const [days, setDays] = useState<number>(DEFAULT_DAYS)
  const [data, setData] = useState<DiscoveryOverview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on "Try again".
  useEffect(() => {
    let live = true
    setFailed(false)
    api.search
      .overview({ days })
      .then((next) => {
        if (live) setData(next)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [days, attempt])

  // Event handlers
  const handlePeriod = (value: unknown) => {
    const next = Number(value)
    if (next) setDays(next)
  }

  // Render logic
  const o = copy.overview
  const items = Object.fromEntries(OVERVIEW_PERIODS.map((d) => [String(d), o.periods[d] ?? '']))
  const period = (
    <Select items={items} value={String(days)} onValueChange={handlePeriod}>
      <SelectTrigger aria-label={o.period} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OVERVIEW_PERIODS.map((d) => (
          <SelectItem key={d} value={String(d)}>
            {o.periods[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const funnel = data?.funnel
  const before = data?.previous

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={o.title} summary={o.summary} actions={period} />
      {failed ? (
        <InlineState
          kind="error"
          body={o.loadFailed}
          action={
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {o.retry}
            </Button>
          }
        />
      ) : (
        <>
          <DataCard title={o.funnel.title} subtitle={o.funnel.note} flush>
            <StatStrip
              loading={!data}
              tiles={[
                {
                  id: 'sessions',
                  label: o.funnel.sessions,
                  value: fmt.number(funnel?.sessions ?? 0),
                  trend: discoveryChange(funnel?.sessions ?? 0, before?.sessions ?? 0),
                  trendNote: o.vsBefore,
                },
                ...STEPS.map((step) => ({
                  id: step,
                  label: o.funnel[step],
                  value: fmt.number(funnel?.[step] ?? 0),
                  trend: discoveryChange(funnel?.[step] ?? 0, before?.[step] ?? 0),
                  trendNote: o.funnel.ofSessions(
                    formatRate(discoveryRate(funnel?.[step] ?? 0, funnel?.sessions ?? 0)),
                  ),
                })),
              ]}
            />
          </DataCard>
          <DataCard title={o.top.title} flush>
            <SearchQueryTable
              rows={data?.topSearches ?? []}
              empty={o.top.empty}
              shortcuts={['synonym', 'pin']}
            />
          </DataCard>
          <div className="grid gap-5 xl:grid-cols-2">
            <DataCard title={o.noResults.title} flush>
              <SearchQueryTable
                rows={data?.noResults ?? []}
                empty={o.noResults.empty}
                shortcuts={['synonym', 'pin']}
              />
            </DataCard>
            <DataCard title={o.noClicks.title} flush>
              <SearchQueryTable
                rows={data?.noClicks ?? []}
                empty={o.noClicks.empty}
                shortcuts={['pin']}
              />
            </DataCard>
          </div>
          <DataCard title={o.recommendations.title} flush>
            <RecommendationStatsTable rows={data?.recommendations ?? []} />
          </DataCard>
        </>
      )}
    </div>
  )
}
