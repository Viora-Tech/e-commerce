'use client'

import type { PlanBill } from '@commerce/core'
import { ExternalLink, ReceiptIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'

type BillsCardProps = { bills: PlanBill[] }

const TONE = { due: 'attention', paid: 'success', cancelled: 'neutral' } as const

/** Figma "Invoices" and "No invoices yet": each plan bill, with Pay while due and View once paid. */
export default function BillsCard({ bills }: BillsCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Early returns
  if (bills.length === 0) {
    return (
      <DataCard title={copy.bills.heading}>
        <EmptyState
          variant="plain"
          size="sm"
          icon={ReceiptIcon}
          heading={copy.bills.empty}
          body={copy.bills.emptyBody}
        />
      </DataCard>
    )
  }

  // Render logic
  const b = copy.bills

  return (
    <DataCard title={b.heading} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{b.number}</TableHead>
            <TableHead>{b.date}</TableHead>
            <TableHead className="text-right">{b.amount}</TableHead>
            <TableHead>{b.status}</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id}>
              <TableCell className="pl-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground tabular-nums">#{bill.number}</span>
                  <span className="text-caption text-muted-foreground">
                    {b.period(
                      copy.plans[bill.plan].name,
                      format.date(bill.periodStart),
                      format.date(bill.periodEnd),
                    )}
                  </span>
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                {format.date(bill.paidAt ?? bill.periodStart)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="tabular-nums">{format.money(bill.amountPaise)}</span>
                  <span className="text-caption text-muted-foreground">{b.gst}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusChip tone={TONE[bill.status]} variant="dot">
                  {b.states[bill.status]}
                </StatusChip>
              </TableCell>
              <TableCell className="pr-4 text-right">
                {bill.url && bill.status !== 'cancelled' ? (
                  <Button
                    size="sm"
                    variant={bill.status === 'due' ? 'default' : 'ghost'}
                    nativeButton={false}
                    render={<a href={bill.url} target="_blank" rel="noopener noreferrer" />}
                  >
                    {bill.status === 'due' ? b.pay : b.view}
                    <ExternalLink />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
