import type { ImportCounts, ImportStatus } from '@commerce/core/theme-import'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import type { themeImportContent } from '@/data/theme-import'
import ImportStatusBadge from './import-status-badge'

type ImportReportSummaryProps = {
  copy: (typeof themeImportContent)['report']
  imported: ImportCounts
  all: ImportCounts
}

const ORDER: ImportStatus[] = ['imported', 'replaced', 'unavailable', 'unsupported']

/** The two count cards: sections on the imported pages, and every section in the theme. */
export default function ImportReportSummary({ copy, imported, all }: ImportReportSummaryProps) {
  // Render logic
  const cards = [
    { title: copy.onPages, counts: imported },
    { title: copy.wholeTheme, counts: all },
  ]

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {cards.map((card) => (
        <Card key={card.title} gap="none" inset="none">
          <CardHeader className="border-b border-border px-5 py-4">
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {ORDER.map((status) => (
                <li key={status} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-10 text-right text-heading font-semibold tabular-nums text-foreground">
                    {card.counts[status]}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <ImportStatusBadge status={status} label={copy.status[status].label} />
                    <span className="text-caption text-muted-foreground">
                      {copy.status[status].help}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
