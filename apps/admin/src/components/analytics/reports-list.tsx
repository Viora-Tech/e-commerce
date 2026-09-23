import { REPORT_CATEGORIES, type ReportCategory, type ReportDefinition } from '@commerce/api'
import { ChevronRightIcon } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent as copy } from '@/data/analytics'

type ReportsListProps = { reports: readonly ReportDefinition[] }

function byCategory(
  reports: readonly ReportDefinition[],
  category: ReportCategory,
): ReportDefinition[] {
  return reports.filter((r) => r.category === category)
}

/** The report catalogue, grouped by what the merchant is asking about. */
export default function ReportsList({ reports }: ReportsListProps) {
  // Render logic
  const c = copy.reports

  return (
    <PageBody width="frame" className="gap-5">
      <PageHeader title={c.title} subtitle={c.intro} />
      {REPORT_CATEGORIES.map((category) => {
        const items = byCategory(reports, category)
        if (items.length === 0) return null
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-kit-title text-foreground">{c.categories[category]}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((report) =>
                report.available ? (
                  <Link key={report.slug} href={`/analytics/reports/${report.slug}`}>
                    <Card className="h-full gap-1 p-5 transition-shadow hover:shadow-card-hover">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-kit-body font-medium text-foreground">{report.title}</p>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="text-kit-mini text-muted-foreground">{report.description}</p>
                    </Card>
                  </Link>
                ) : (
                  <Card key={report.slug} className="h-full gap-1 p-5 opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-kit-body font-medium text-foreground">{report.title}</p>
                      <span className="shrink-0 text-kit-mini text-muted-foreground-soft">
                        {c.soon}
                      </span>
                    </div>
                    <p className="text-kit-mini text-muted-foreground">{report.description}</p>
                    {report.missing ? (
                      <p className="mt-1 text-kit-mini text-muted-foreground-soft">
                        {report.missing}
                      </p>
                    ) : null}
                  </Card>
                ),
              )}
            </div>
          </section>
        )
      })}
    </PageBody>
  )
}
