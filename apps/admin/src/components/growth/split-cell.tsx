'use client'

import { growthSplitContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SplitCellProps = { salesPaise: number; orders: number }

/** One side of the first-time / returning split: sales, with the order count under it. */
export default function SplitCell({ salesPaise, orders }: SplitCellProps) {
  // Hooks
  const copy = useCopy(growthSplitContent)
  const fmt = useFormat()

  // Render logic
  return (
    <span className="flex flex-col items-end tabular-nums">
      <span>{fmt.money(salesPaise)}</span>
      <span className="text-caption text-muted-foreground">{copy.orders(fmt.number(orders))}</span>
    </span>
  )
}
