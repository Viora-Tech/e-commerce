'use client'

import type { NextBill } from '@commerce/core/billing'
import { Card } from '@commerce/ui/shadcn/card'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { billAmount } from '@/lib/billing'
import AutopayRow, { type AutopayState } from './autopay-row'

type NextBillCardProps = {
  bill: NextBill
  /** Display names of the paid apps on the bill. */
  appNames: Record<string, string>
  autopay: AutopayState
  billingReady: boolean
}

/**
 * Figma 931:9997 "Next bill": the plan at renewal, this month's per-order fees, paid apps and
 * GST, the due date, and UPI AutoPay. Amounts come from `projectNextBill` (core).
 */
export default function NextBillCard({ bill, appNames, autopay, billingReady }: NextBillCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Helpers
  const month = (at: Date | string) => format.pattern(at, { month: 'short' })

  // Render logic
  const c = copy.nextBill
  const rows = [
    {
      id: 'plan',
      label: c.plan(copy.plans[bill.plan].name, month(bill.dueAt)),
      paise: bill.planPaise,
    },
    {
      id: 'fees',
      label: c.fees(month(`${bill.feesMonth}-15T00:00:00Z`)),
      paise: bill.feesPaise,
    },
    ...(bill.apps.length > 0
      ? [
          {
            id: 'apps',
            label: c.apps(bill.apps.map((a) => appNames[a.pluginId] ?? a.pluginId).join(', ')),
            paise: bill.appsPaise,
          },
        ]
      : []),
    { id: 'gst', label: c.gst, paise: bill.gstPaise },
  ]

  return (
    <Card gap={4} inset={5}>
      <h2 className="text-card-title text-ink-strong">{c.heading}</h2>
      <dl className="flex flex-col gap-2.5 border-b border-border pb-4 text-body">
        {rows.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-foreground tabular-nums">{billAmount(r.paise, format.intl)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3 text-body font-medium text-ink-strong">
        <span>{c.due(format.date(bill.dueAt))}</span>
        <span className="tabular-nums">{billAmount(bill.totalPaise, format.intl)}</span>
      </div>
      <p className="text-caption text-muted-foreground">{c.feesNote}</p>
      <AutopayRow autopay={autopay} billingReady={billingReady} />
    </Card>
  )
}
