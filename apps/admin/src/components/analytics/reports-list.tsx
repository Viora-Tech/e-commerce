'use client'

import type { ReportCategory, ReportDefinition } from '@commerce/api'
import { ChevronRightIcon } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useState } from 'react'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import ReportQueryBar from './report-query-bar'

type ReportsListProps = { reports: readonly ReportDefinition[] }

function inCategory(
  reports: readonly ReportDefinition[],
  category: ReportCategory,
): ReportDefinition[] {
  return reports.filter((r) => r.category === category)
}

const CATEGORIES = Object.keys(analyticsContent.reports.categories) as ReportCategory[]

function matches(report: ReportDefinition, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${report.title} ${report.description}`.toLowerCase().includes(q)
}

/** The report catalogue, grouped by what the merchant is asking about. */
export default function ReportsList({ reports }: ReportsListProps) {
  // Hooks
  const { reports: c } = useCopy(analyticsContent)
  const [query, setQuery] = useState('')

  // Render logic
  const found = reports.filter((r) => matches(r, query))

  return (
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader title={c.title} summary={c.intro} />
      <ReportQueryBar value={query} onChange={setQuery} />
      {found.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.ask.noMatch}</p>
      ) : null}
      {CATEGORIES.map((category) => {
        const items = inCategory(found, category)
        if (items.length === 0) return null
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-card-title text-ink-strong">{c.categories[category]}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((report) =>
                report.available ? (
                  <Link key={report.slug} href={routes.analytics.report(report.slug)}>
                    <Card className="h-full gap-1 p-5 motion-press hover:shadow-card-hover">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-strong text-foreground">{report.title}</p>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="text-caption text-muted-foreground">{report.description}</p>
                    </Card>
                  </Link>
                ) : (
                  <Card key={report.slug} className="h-full gap-1 p-5 opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-body-strong text-foreground">{report.title}</p>
                      <span className="shrink-0 text-caption text-muted-foreground">{c.soon}</span>
                    </div>
                    <p className="text-caption text-muted-foreground">{report.description}</p>
                    {report.missing ? (
                      <p className="mt-1 text-caption text-muted-foreground">{report.missing}</p>
                    ) : null}
                  </Card>
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
