'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { variantLabel } from '@/components/inventory/variant-picker'
import KitThumb from '@/components/kit/kit-thumb'
import { landedCostContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { CostPreview } from './types'

type LandedCostCardProps = {
  costs: CostPreview
  /** Only these orders' lines (a purchase order page); every line when omitted (a shipment). */
  purchaseOrderId?: string
}

function sumOf<T>(xs: T[], pick: (x: T) => number): number {
  return xs.reduce((n, x) => n + pick(x), 0)
}

const ROW = 'grid-cols-[minmax(0,1fr)_3.5rem_6rem_6rem_6rem_6rem]'

/** Goods, share of charges and landed cost per unit for each line, next to today's cost. */
export default function LandedCostCard({ costs, purchaseOrderId }: LandedCostCardProps) {
  // Hooks
  const copy = useCopy(landedCostContent)
  const fmt = useFormat()

  // Render logic
  const lines = purchaseOrderId
    ? costs.lines.filter((l) => l.purchaseOrderId === purchaseOrderId)
    : costs.lines
  const showOrder = !purchaseOrderId
  const goods = sumOf(lines, (l) => l.goodsPaise)
  const charges = sumOf(lines, (l) => l.chargesPaise)
  const totals = [
    { label: copy.totals.goods, value: goods },
    { label: copy.totals.charges, value: charges },
    { label: copy.totals.recoverable, value: sumOf(lines, (l) => l.recoverablePaise), quiet: true },
  ]

  return (
    <Card size="form" gap="none" inset="y-none">
      <CardHeader className="py-5">
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.summary}</CardDescription>
      </CardHeader>
      {lines.length === 0 ? (
        <p className="border-line border-t px-5 py-10 text-center text-body text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ul className="flex min-w-[40rem] flex-col">
            <li
              className={`grid h-10 ${ROW} items-center gap-3 border-line border-y bg-muted/50 px-5 text-caption font-medium text-muted-foreground`}
            >
              <span>{copy.columns.product}</span>
              <span className="text-right">{copy.columns.quantity}</span>
              <span className="text-right">{copy.columns.goods}</span>
              <span className="text-right">{copy.columns.charges}</span>
              <span className="text-right">{copy.columns.landed}</span>
              <span className="text-right">{copy.columns.current}</span>
            </li>
            {lines.map((l) => (
              <li
                key={l.lineId}
                className={`grid ${ROW} items-center gap-3 border-line border-b px-5 py-3 text-body tabular-nums last:border-b-0`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <KitThumb src={l.imageUrl} alt="" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{variantLabel(l)}</span>
                    {showOrder ? (
                      <span className="text-caption text-muted-foreground">
                        {copy.order(l.purchaseOrderNumber)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="text-right">{l.quantity}</span>
                <span className="text-right">{fmt.money(l.goodsPaise)}</span>
                <span className="text-right">{fmt.money(l.chargesPaise)}</span>
                <span className="text-right text-body-strong">{fmt.money(l.landedUnitPaise)}</span>
                <span className="text-right text-muted-foreground">
                  {l.currentCostPaise === null ? copy.notSet : fmt.money(l.currentCostPaise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="flex flex-col gap-2 border-line border-t px-5 py-4 text-body">
        {totals.map((t) => (
          <div
            key={t.label}
            className={`flex justify-between gap-3 ${t.quiet ? 'text-muted-foreground' : ''}`}
          >
            <dt>{t.label}</dt>
            <dd className="tabular-nums">{fmt.money(t.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-line border-t pt-2 text-body-strong">
          <dt>{copy.totals.landed}</dt>
          <dd className="tabular-nums">{fmt.money(goods + charges)}</dd>
        </div>
      </dl>
    </Card>
  )
}
