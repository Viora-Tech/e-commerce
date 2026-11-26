'use client'

import type { PortalSale } from '@commerce/plugin-affiliates/server'
import { CircleAlert, CircleCheck, CircleDashed, Clock } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { type ReactNode, useState } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { day, money } from '@/lib/portal-format'
import TablePagination from './table-pagination'

type CommissionsTableProps = {
  rows: PortalSale[]
  empty: string
  /** Filters and Export, at the end of the tabs row (dashboard-01's "Customize Columns"). */
  toolbar?: ReactNode
  /** Rows per page to start with. */
  pageSize?: number | undefined
}

type Tab = 'all' | 'pending' | 'approved' | 'paid' | 'reversed'

const copy = affiliatePortalContent.commissions
const sale = affiliateContent.dashboard.sale
const words = affiliateContent.dashboard.status

const TABS: Tab[] = ['all', 'pending', 'approved', 'paid', 'reversed']

/** A commission's status cell: its stage with dashboard-01's icon, and why when there is one. */
function statusOf(r: PortalSale): { label: string; icon: ReactNode; note: string | null } {
  if (r.held) return { label: sale.held, icon: <CircleAlert />, note: null }
  if (r.status === 'reversed')
    return {
      label: words.reversed ?? r.status,
      icon: <CircleAlert className="text-destructive" />,
      note: r.reversedReason ? (sale.reversed[r.reversedReason] ?? null) : null,
    }
  if (r.status === 'paid')
    return {
      label: words.paid ?? r.status,
      icon: <CircleCheck className="text-success" />,
      note: null,
    }
  if (r.status === 'approved')
    return { label: words.approved ?? r.status, icon: <Clock />, note: null }
  return {
    label: words.pending ?? r.status,
    icon: <CircleDashed />,
    note: r.eligibleAt ? sale.clears(day(r.eligibleAt)) : null,
  }
}

/**
 * dashboard-01's DataTable for commissions: status tabs with counts, a toolbar slot, the table in
 * a bordered box with a muted header row, and pagination below. Customer names are masked.
 */
export default function CommissionsTable({
  rows,
  empty,
  toolbar,
  pageSize: firstSize = 10,
}: CommissionsTableProps) {
  // Hooks
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(firstSize)

  // Event handlers
  const handleTab = (value: unknown) => {
    setTab(TABS.find((t) => t === value) ?? 'all')
    setPage(0)
  }
  const handlePageSize = (size: number) => {
    setPageSize(size)
    setPage(0)
  }

  // Render logic
  const count = (t: Tab) => (t === 'all' ? rows.length : rows.filter((r) => r.status === t).length)
  const shown = tab === 'all' ? rows : rows.filter((r) => r.status === tab)
  const pageRows = shown.slice(page * pageSize, (page + 1) * pageSize)
  const c = copy.columns
  return (
    <Tabs value={tab} onValueChange={handleTab} className="w-full flex-col justify-start gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <TabsList className="**:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {copy.tabs[t]}
              {t !== 'all' && count(t) > 0 ? <Badge variant="secondary">{count(t)}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="pl-4">{c.date}</TableHead>
                <TableHead>{c.customer}</TableHead>
                <TableHead>{c.source}</TableHead>
                <TableHead>{c.status}</TableHead>
                <TableHead className="text-right">{c.sale}</TableHead>
                <TableHead className="pr-4 text-right">{c.commission}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {empty}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const s = statusOf(r)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 whitespace-nowrap">{day(r.placedAt)}</TableCell>
                      <TableCell>{r.buyer ?? sale.buyer}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="px-1.5 text-muted-foreground">
                          {sale.source[r.source] ?? r.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge variant="outline" className="px-1.5 text-muted-foreground">
                            {s.icon}
                            {s.label}
                          </Badge>
                          {s.note ? (
                            <span className="text-xs text-muted-foreground">{s.note}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(r.basePaise)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">
                        {money(r.commissionPaise)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <TablePagination
        total={shown.length}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={handlePageSize}
      />
    </Tabs>
  )
}
