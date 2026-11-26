'use client'

import type { PortalPayout } from '@commerce/plugin-affiliates/server'
import { CircleCheck, CircleDashed, CreditCard } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { day, money } from '@/lib/portal-format'
import PortalEmpty from './portal-empty'
import TablePagination from './table-pagination'

type PayoutsTableProps = { rows: PortalPayout[] }

const copy = affiliatePortalContent.payouts

/** A deduction, shown with its minus sign; nothing deducted shows ₹0. */
const minus = (paise: number) => (paise ? `-${money(paise)}` : money(0))

/**
 * Their payouts in dashboard-01's table style: when, status, commission, TDS, returned orders,
 * GST, what reached them and the store's reference, with pagination. Drawn inside the Payouts
 * card, so it has no page gutter of its own.
 */
export default function PayoutsTable({ rows }: PayoutsTableProps) {
  // Hooks
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // Event handlers
  const handlePageSize = (size: number) => {
    setPageSize(size)
    setPage(0)
  }

  // Early returns
  if (rows.length === 0)
    return (
      <PortalEmpty
        icon={CreditCard}
        title={copy.none.title}
        description={copy.none.text}
        className="rounded-lg border border-dashed p-6 md:p-8"
      />
    )

  // Render logic
  const c = copy.columns
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize)
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="pl-4">{c.created}</TableHead>
              <TableHead>{c.status}</TableHead>
              <TableHead className="text-right">{c.commission}</TableHead>
              <TableHead className="text-right">{c.tds}</TableHead>
              <TableHead className="text-right">{c.clawback}</TableHead>
              <TableHead className="text-right">{c.gst}</TableHead>
              <TableHead className="text-right">{c.net}</TableHead>
              <TableHead className="pr-4 pl-6">{c.reference}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 whitespace-nowrap">{day(r.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="px-1.5 text-muted-foreground">
                      {r.status === 'paid' ? (
                        <CircleCheck className="text-success" />
                      ) : (
                        <CircleDashed />
                      )}
                      {r.status === 'paid' && r.paidAt
                        ? `${copy.status.paid} ${day(r.paidAt)}`
                        : (copy.status[r.status] ?? r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.grossPaise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{minus(r.tdsPaise)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {minus(r.clawbackPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.gstPaise)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(r.netPaise)}
                  </TableCell>
                  <TableCell className="pr-4 pl-6 font-mono text-xs">{r.reference}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {rows.length > 10 ? (
        <TablePagination
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={handlePageSize}
          flush
        />
      ) : null}
    </div>
  )
}
