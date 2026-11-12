'use client'

import type { AnswerTable } from '@commerce/api'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useRouter } from 'next/navigation'
import { analyticsContent } from '@/data/analytics'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'
import { openAsReportHref, snapshotOf, stashAnswer } from '@/lib/answer-report'
import { formatCell, isNumericKind } from '@/lib/report-format'
import { useStorageScope } from '@/lib/storage-scope'
import AnswerChart from './answer-chart'

type AnswerTableCardProps = {
  table: AnswerTable
  /** The tool that read the rows (`topProducts`). */
  tool: string
  /** What the merchant asked, kept with a snapshot. */
  question: string
}

/**
 * The rows behind an answer as a compact table with a small chart (#192). Every cell comes
 * from the tool's own output, never from the model. "Open as report" opens it live as a
 * custom query when it can be written as one, else as a snapshot that says so (#102).
 */
export default function AnswerTableCard({ table, tool, question }: AnswerTableCardProps) {
  // Hooks
  const storageScope = useStorageScope()
  const copy = useCopy(assistantContent)
  const columns = useCopy(analyticsContent.reports.columns)
  const router = useRouter()

  // Event handlers
  const handleOpen = () => {
    if (!table.query)
      stashAnswer(storageScope, snapshotOf(table, { tool, question, answeredAt: new Date() }))
    router.push(openAsReportHref(table))
  }

  // Early returns
  if (!table.rows.length || !table.columns.length) return null

  // Render logic
  const what = copy.tools[tool] ?? tool

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-caption font-medium text-ink-strong">{copy.table.label(what)}</p>
        <p className="text-caption text-muted-foreground">{copy.table.rows(table.rows.length)}</p>
      </div>
      <AnswerChart table={table} />
      <div className="max-h-60 overflow-auto rounded-lg border border-border">
        <Table className="text-caption">
          <TableHeader>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={`h-8 px-2 ${isNumericKind(column.kind) ? 'text-right' : ''}`}
                >
                  {columns[column.id] ?? column.id}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.key}>
                {table.columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={`px-2 py-1.5 ${isNumericKind(column.kind) ? 'text-right tabular-nums' : 'max-w-40 truncate'}`}
                  >
                    {formatCell(column.kind, row.values[column.id] ?? null)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-caption text-muted-foreground">
          {table.query ? copy.table.live : copy.table.snapshot}
        </p>
        <Button size="sm" variant="outline" onClick={handleOpen}>
          <ExternalLink aria-hidden="true" />
          {copy.table.open}
        </Button>
      </div>
    </div>
  )
}
