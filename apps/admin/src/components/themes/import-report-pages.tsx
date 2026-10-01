import type { TemplateReport } from '@commerce/core/theme-import'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import type { themeImportContent } from '@/data/theme-import'

type ImportReportPagesProps = {
  copy: (typeof themeImportContent)['report']
  templates: TemplateReport[]
}

/** Which pages use the theme's own sections and which use ours inside its header and footer. */
export default function ImportReportPages({ copy, templates }: ImportReportPagesProps) {
  // Render logic
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>{copy.pagesHeading}</CardTitle>
        <CardDescription>{copy.pagesBody}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="text-body font-medium text-foreground">
                {copy.pageNames[t.name] ?? t.name}
              </span>
              <span className="text-body text-muted-foreground">{copy.pages[t.status]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
