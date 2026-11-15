import type { TemplateReport } from '@commerce/core/theme-import'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import type { themeImportContent } from '@/data/theme-import'

type ImportReportPagesProps = {
  copy: Copy
  templates: TemplateReport[]
}

type Copy = (typeof themeImportContent)['report']

/** A template's name for merchants; an alternate (`page.about`) as "Pages: about". */
function pageName(copy: Copy, name: string): string {
  const names = copy.pageNames as Record<string, string>
  const known = names[name]
  if (known) return known
  const [base = '', ...rest] = name.split('.')
  const page = names[base]
  return page && rest.length > 0 ? copy.alternate(page, rest.join('.')) : name
}

/** Which pages use the theme's own sections and which use ours inside its header and footer. */
export default function ImportReportPages({ copy, templates }: ImportReportPagesProps) {
  // Render logic
  return (
    <DataCard title={copy.pagesHeading} subtitle={copy.pagesBody} flush>
      <ScrollSection id="theme-report-pages" label={copy.pagesHeading} count={templates.length}>
        <ul className="divide-y divide-border border-t border-border">
          {templates.map((t) => (
            <li
              key={t.name}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
            >
              <span className="text-body font-medium text-foreground">
                {pageName(copy, t.name)}
              </span>
              <span className="text-body text-muted-foreground">{copy.pages[t.status]}</span>
            </li>
          ))}
        </ul>
      </ScrollSection>
    </DataCard>
  )
}
