'use client'

import type { PlanBill } from '@commerce/core'
import { ExternalLink, ReceiptIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { billAmount, lastDay } from '@/lib/billing'

type BillsCardProps = {
  bills: PlanBill[]
  /** Where invoices are emailed: the store's contact email. */
  invoiceEmail?: string | null | undefined
}

const TONE = { due: 'attention', paid: 'success', cancelled: 'neutral' } as const

/**
 * Figma 931:9997 "Invoices": each plan bill with its period, amount and status, Pay while due
 * and Download (the sales store's order page, with the GST invoice) once paid.
 */
export default function BillsCard({ bills, invoiceEmail = null }: BillsCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Render logic
  const b = copy.bills
  const subtitle = invoiceEmail ? b.sentTo(invoiceEmail) : undefined

  return (
    <DataCard title={b.heading} subtitle={subtitle} flush={bills.length > 0}>
      {bills.length === 0 ? (
        <EmptyState
          variant="plain"
          size="sm"
          icon={ReceiptIcon}
          heading={b.empty}
          body={b.emptyBody}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {bills.map((bill) => (
            <li
              key={bill.id}
              className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 px-5 py-3 md:grid-cols-[8rem_1fr_auto_auto_6rem]"
            >
              <span className="text-body font-medium text-ink-strong tabular-nums">
                #{bill.number}
              </span>
              <span className="text-body text-muted-foreground">
                {b.period(
                  copy.plans[bill.plan].name,
                  format.date(bill.periodStart),
                  format.date(lastDay(bill.periodEnd)),
                )}
              </span>
              <span className="text-body text-ink-strong tabular-nums md:text-right" title={b.gst}>
                {billAmount(bill.amountPaise, format.intl)}
              </span>
              <StatusChip tone={TONE[bill.status]} variant="outline">
                {b.states[bill.status]}
              </StatusChip>
              <span className="col-span-2 md:col-span-1 md:text-right">
                {bill.url && bill.status !== 'cancelled' ? (
                  <Button
                    size="sm"
                    variant={bill.status === 'due' ? 'default' : 'ghost'}
                    nativeButton={false}
                    render={<a href={bill.url} target="_blank" rel="noopener noreferrer" />}
                  >
                    {bill.status === 'due' ? b.pay : b.download}
                    {bill.status === 'due' ? <ExternalLink /> : null}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
