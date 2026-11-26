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
import type { ReactNode } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { day, money } from '@/lib/portal-format'

type CommissionsGridProps = {
  /** The rows to draw (already one page). */
  rows: PortalSale[]
  /** Shown in one full-width cell when there are no rows. */
  empty: ReactNode
}

const sale = affiliateContent.dashboard.sale
const words = affiliateContent.dashboard.status

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
 * dashboard-01's table for commissions: a muted header row, the date, masked customer, source,
 * status with its icon (and why), the sale and the commission. No border of its own: the page
 * or card around it draws one.
 */
export default function CommissionsGrid({ rows, empty }: CommissionsGridProps) {
  // Render logic
  const c = affiliatePortalContent.commissions.columns
  return (
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
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => {
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
                <TableCell className="text-right tabular-nums">{money(r.basePaise)}</TableCell>
                <TableCell className="pr-4 text-right font-medium tabular-nums">
                  {money(r.commissionPaise)}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
