import type { SectionReport } from '@commerce/core/theme-import'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import ScrollSection from '@/components/layout/scroll-section'
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
    <Card gap="none" inset="none">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>{copy.sectionsHeading}</CardTitle>
        <CardDescription>{copy.sectionsBody}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollSection
          id="theme-report-sections"
          label={copy.sectionsHeading}
          count={sections.length}
          maxHeight="min(36rem, 70vh)"
          className="pb-2"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{copy.columns.section}</TableHead>
                <TableHead>{copy.columns.status}</TableHead>
                <TableHead>{copy.columns.why}</TableHead>
                <TableHead className="pr-5">{copy.columns.usedIn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((s) => (
                <TableRow key={s.type}>
                  <TableCell className="pl-5 align-top">
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
                  <TableCell className="pr-5 align-top text-muted-foreground">
                    {placed(s)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollSection>
      </CardContent>
    </Card>
  )
}
