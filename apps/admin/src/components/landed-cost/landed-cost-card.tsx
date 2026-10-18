'use client'

import { variantLabel } from '@/components/inventory/variant-picker'
import KitThumb from '@/components/kit/kit-thumb'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
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
  const totals: TotalsLine[] = [
    { label: copy.totals.goods, value: fmt.money(goods) },
    { label: copy.totals.charges, value: fmt.money(charges) },
    {
      label: copy.totals.recoverable,
      value: fmt.money(sumOf(lines, (l) => l.recoverablePaise)),
      quiet: true,
    },
    { label: copy.totals.landed, value: fmt.money(goods + charges), strong: true },
  ]

  return (
    <DataCard title={copy.heading} subtitle={copy.summary} flush>
      {lines.length === 0 ? (
        <EmptyState
          variant="plain"
          size="lg"
          className="border-line border-t px-5"
          body={copy.empty}
        />
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
      <TotalsList lines={totals} className="border-line border-t px-5 py-4" />
    </DataCard>
  )
}
