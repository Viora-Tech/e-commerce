import type { SectionReport } from '@commerce/core/theme-import'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import SimpleTable from '@/components/table/simple-table'
import type { themeImportContent } from '@/data/theme-import'
import ImportStatusBadge from './import-status-badge'

type ImportReportSectionsProps = {
  copy: (typeof themeImportContent)['report']
  sections: SectionReport[]
}

/** Every section of the theme: its result, what runs it now, and where the theme places it. */
export default function ImportReportSections({ copy, sections }: ImportReportSectionsProps) {
  // Render logic
  const placed = (s: SectionReport) =>
    s.usedIn.length ? s.usedIn.map((u) => copy.usedIn[u] ?? u).join(', ') : copy.notPlaced
  const why = (s: SectionReport) =>
    s.reasons.length ? s.reasons.map((r) => copy.reasons[r]).join('. ') : copy.exact

  return (
    <DataCard title={copy.sectionsHeading} subtitle={copy.sectionsBody} flush>
      <ScrollSection
        id="theme-report-sections"
        label={copy.sectionsHeading}
        count={sections.length}
        maxHeight="min(36rem, 70vh)"
      >
        <SimpleTable
          columns={[
            { key: 'section', label: copy.columns.section },
            { key: 'status', label: copy.columns.status },
            { key: 'why', label: copy.columns.why },
            { key: 'usedIn', label: copy.columns.usedIn },
          ]}
        >
          {sections.map((s) => (
            <TableRow key={s.type}>
              <TableCell className="align-top">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-caption text-muted-foreground">{s.type}</span>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <ImportStatusBadge status={s.status} label={copy.status[s.status].label} />
              </TableCell>
              <TableCell className="max-w-md align-top whitespace-normal text-muted-foreground">
                {why(s)}
              </TableCell>
              <TableCell className="align-top text-muted-foreground">{placed(s)}</TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </ScrollSection>
    </DataCard>
  )
}
