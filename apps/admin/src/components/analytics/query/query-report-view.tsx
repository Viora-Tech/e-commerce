'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import {
  formatQuery,
  parseQuery,
  type QueryError,
  type QueryTable,
} from '@commerce/core/analytics-query'
import { ArrowRight, CircleAlert, CircleCheck, Download, ListTree } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadReportCsv } from '@/lib/report-csv'
import { routes } from '@/lib/routes'
import ReportChart from '../report-chart'
import ReportTable from '../report-table'
import QueryEditor from './query-editor'
import QuerySchemaPanel from './query-schema-panel'

type Ran = { report: ReportDefinition; result: ReportResult; ms: number }

type QueryReportViewProps = {
  initialSource: string
  initial: Ran | null
}

/** Figma "Analytics · Report — query editor": write a query, run it read-only, see chart and rows. */
export default function QueryReportView({ initialSource, initial }: QueryReportViewProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const [source, setSource] = useState(initialSource)
  const [ran, setRan] = useState<Ran | null>(initial)
  const [error, setError] = useState<QueryError | null>(null)
  const [busy, setBusy] = useState(false)
  const [shape, setShape] = useState<ReportDefinition['chart'] | null>(null)

  // Event handlers
  const handleRun = async () => {
    const parsed = parseQuery(source)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const out = await api.analytics.query({ source })
      if (out.ok) {
        setRan({ report: out.report, result: out.result, ms: out.ms })
        setShape(null)
      } else {
        setError(out.error)
      }
    } catch {
      setError({ line: 1, message: copy.failed, suggestion: null })
    } finally {
      setBusy(false)
    }
  }

  const handleFormat = () => {
    const parsed = parseQuery(source)
    if (parsed.ok) setSource(formatQuery(parsed.query))
    else setError(parsed.error)
  }

  const handleInsert = (name: string) => {
    setSource((s) => (s.endsWith(' ') || s.endsWith('\n') ? `${s}${name}` : `${s} ${name}`))
  }

  // Render logic
  const parsed = parseQuery(source)
  const table: QueryTable = parsed.ok ? parsed.query.table : 'sales'

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 md:px-8">
      <PageHeader
        title={copy.title}
        summary={copy.summary}
        back={{ label: copy.back, href: routes.analytics.reports() }}
        lead={{ kind: 'icon', node: <ListTree aria-hidden="true" /> }}
        actions={
          ran ? (
            <Button
              variant="outline"
              onClick={() => downloadReportCsv('custom-query.csv', ran.report, ran.result)}
            >
              <Download />
              {copy.export}
            </Button>
          ) : null
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex items-center gap-2 border-border border-b px-3 py-2">
            <h2 className="flex-1 text-eyebrow text-muted-foreground">{copy.queryHeading}</h2>
            <Button variant="ghost" size="sm" onClick={handleFormat}>
              {copy.format}
            </Button>
            <Button size="sm" onClick={handleRun} disabled={busy}>
              <ArrowRight />
              {copy.run}
            </Button>
          </header>
          <QueryEditor
            value={source}
            errorLine={error?.line ?? null}
            onChange={setSource}
            onRun={handleRun}
          />
          <footer className="flex items-center gap-2 border-border border-t px-3 py-2 text-caption">
            {error ? (
              <span className="flex items-center gap-1.5 text-danger" role="alert">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                {copy.errorLine(error.line, error.message)}
                {error.suggestion ? ` ${copy.didYouMean(error.suggestion)}` : null}
              </span>
            ) : ran ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
                {copy.ranIn(ran.ms, ran.result.rows.length)}
              </span>
            ) : (
              <span className="text-muted-foreground">{copy.hint}</span>
            )}
          </footer>
        </section>
        <QuerySchemaPanel table={table} onInsert={handleInsert} />
      </div>
      {ran ? (
        <>
          <DataCard
            title={copy.chartHeading}
            action={
              <PillTabs
                variant="segmented"
                value={shape ?? ran.report.chart}
                onChange={setShape}
                tabs={[
                  { value: 'bars', label: copy.bar },
                  { value: 'series', label: copy.line },
                ]}
              />
            }
          >
            <ReportChart report={ran.report} data={ran.result} shape={shape ?? ran.report.chart} />
          </DataCard>
          <DataCard title={copy.details} flush>
            <ReportTable report={ran.report} data={ran.result} />
          </DataCard>
        </>
      ) : null}
    </div>
  )
}
