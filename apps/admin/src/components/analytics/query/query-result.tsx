'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { Minus, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import ReportChart from '../report-chart'
import ReportTable from '../report-table'
import type { Ran } from './use-query-runner'

type QueryResultProps = {
  ran: Ran
}

type Viz = ReportDefinition['chart'] | 'table'

/** Bars show the top 10 rows by default; a line shows every point. */
const BARS_DEFAULT = 10

/** The chart's points: the first `count` rows, by the query's metric. */
function chartOf(ran: Ran, count: number): ReportResult['chart'] {
  const metric = ran.report.metric
  return ran.result.rows.slice(0, count).map((r) => {
    const value = r.values[metric]
    return {
      label: r.key,
      value: typeof value === 'number' ? value : 0,
      previous: r.previous ?? null,
    }
  })
}

/** What a query returned: Bar, Line or Table, an "Items shown" stepper, and every row below. */
export default function QueryResult({ ran }: QueryResultProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const [viz, setViz] = useState<Viz | null>(null)
  const [items, setItems] = useState<number | null>(null)

  // Render logic
  const shape = viz ?? ran.report.chart
  const total = ran.result.rows.length
  const fallback = shape === 'series' ? total : Math.min(BARS_DEFAULT, total)
  const shown = Math.min(Math.max(1, items ?? fallback), Math.max(1, total))
  const data = { ...ran.result, chart: chartOf(ran, shown) }
  const tabs = (
    <div className="flex flex-wrap items-center gap-2">
      {shape !== 'table' && total > 1 ? (
        <fieldset className="flex items-center gap-1" aria-label={copy.viz.items}>
          <span className="text-caption text-muted-foreground">{copy.viz.items}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={copy.viz.fewer}
            disabled={shown <= 1}
            onClick={() => setItems(shown - 1)}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-6 text-center text-caption tabular-nums" aria-live="polite">
            {shown}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={copy.viz.more}
            disabled={shown >= total}
            onClick={() => setItems(shown + 1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </fieldset>
      ) : null}
      <PillTabs<Viz>
        variant="segmented"
        value={shape}
        onChange={setViz}
        tabs={[
          { value: 'bars', label: copy.bar },
          { value: 'series', label: copy.line },
          { value: 'table', label: copy.viz.table },
        ]}
      />
    </div>
  )

  return (
    <>
      <DataCard title={copy.chartHeading} action={tabs} flush={shape === 'table'}>
        {shape === 'table' ? (
          <ReportTable report={ran.report} data={ran.result} />
        ) : (
          <ReportChart report={ran.report} data={data} shape={shape} />
        )}
      </DataCard>
      {shape === 'table' ? null : (
        <DataCard title={copy.details} flush>
          <ReportTable report={ran.report} data={ran.result} />
        </DataCard>
      )}
    </>
  )
}
