'use client'

import { Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'

export type DemandRow = {
  variantId: string
  label: string
  waiting: number
  newSignups: number
  notified: number
  waitingSince: Date | string | null
}

type DemandTableProps = {
  rows: DemandRow[]
}

type View = 'all' | 'fresh' | 'old'

const MONTH_MS = 30 * 86_400_000

/** The rows a tab shows: everything, ones with sign-ups in the period, or waiting 30+ days. */
function inView(row: DemandRow, view: View, now: number): boolean {
  if (view === 'fresh') return row.newSignups > 0
  if (view === 'old') {
    return row.waitingSince !== null && now - new Date(row.waitingSince).getTime() >= MONTH_MS
  }
  return true
}

const HEAD = 'h-9 px-4 text-caption font-medium text-muted-foreground'
const CELL = 'px-4 py-3 text-body'

/**
 * The Analytics list under the figures (Essential's All · New sign-ups · Waiting 30+ days):
 * one row per variant anyone asked about, with a product search.
 */
export default function DemandTable({ rows }: DemandTableProps) {
  // Hooks
  const { overview: copy } = useCopy(backInStockContent)
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')

  // Render logic
  const now = Date.now()
  const needle = query.trim().toLowerCase()
  const shown = rows.filter(
    (r) => inView(r, view, now) && (!needle || r.label.toLowerCase().includes(needle)),
  )

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-hairline border-b px-4 py-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="all">{copy.tabs.all}</TabsTrigger>
            <TabsTrigger value="fresh">{copy.tabs.fresh}</TabsTrigger>
            <TabsTrigger value="old">{copy.tabs.old}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="h-8 pl-8"
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState heading={copy.empty} body={copy.emptyBody} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.columns.variant}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.waiting}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.newSignups}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.notified}</TableHead>
              <TableHead className={HEAD}>{copy.columns.since}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className={`${CELL} text-center text-muted-foreground`}>
                  {copy.emptyTab}
                </TableCell>
              </TableRow>
            ) : null}
            {shown.map((r) => (
              <TableRow key={r.variantId}>
                <TableCell className={`${CELL} font-medium`}>{r.label}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>{r.waiting}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>{r.newSignups}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>{r.notified}</TableCell>
                <TableCell className={`${CELL} text-muted-foreground`}>
                  {r.waitingSince ? <RelativeTime value={r.waitingSince} /> : copy.none}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
