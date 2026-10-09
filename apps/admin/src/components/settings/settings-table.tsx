'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

export type SettingsTableColumn = {
  label: string
  /** Centre the column (status chips). */
  center?: boolean
  /** Extra classes, e.g. `hidden md:table-cell` on the head and its cells. */
  className?: string
}

type SettingsTableProps = {
  columns: SettingsTableColumn[]
  /** Rows made of `SettingsTableRow`. */
  children: ReactNode
  /** Number of rows, for the "Showing 1–n of n" footer. Leave out to hide the footer. */
  total?: number
  /** A section title above the grid inside the card. */
  heading?: string
  /** The plain-words line under the heading. */
  description?: string
  /** Adds the empty trailing column for row actions. */
  actions?: boolean
}

/* Proofly table (Figma "Table · Header / Row"), the same density as the resource tables. */
const HEAD =
  'h-10 border-b border-line bg-card px-3 py-0 text-caption font-medium text-muted-foreground first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'

/** Class for a body cell: pass to `TableCell` (or use `SettingsTableCell`). */
export const SETTINGS_CELL =
  'h-12 border-b border-line px-3 py-1.5 text-body first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'

/** A short table inside a card, for settings lists (team, domains, zones, messages). */
export default function SettingsTable({
  columns,
  children,
  total,
  heading,
  description,
  actions = false,
}: SettingsTableProps) {
  // Hooks
  const copy = useCopy(tableContent)

  return (
    <Card gap="none" inset="none">
      {heading ? (
        <header className="flex flex-col gap-0.5 px-4 pt-4 pb-3 md:px-6">
          <h2 className="text-body font-semibold text-ink-strong">{heading}</h2>
          {description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
        </header>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.label} className={cn(HEAD, c.center && 'text-center', c.className)}>
                {c.label}
              </TableHead>
            ))}
            {actions ? <TableHead className={cn(HEAD, 'w-16')} /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
      {total === undefined || total === 0 ? null : (
        <p className="px-4 py-3 text-caption text-muted-foreground md:px-6">
          {copy.showing(1, total, total)}
        </p>
      )}
    </Card>
  )
}
