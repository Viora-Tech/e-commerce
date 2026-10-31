'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Adjustment = Awaited<ReturnType<typeof api.products.adjustments>>[number]

type StockHistoryCardProps = { productId: string }

const WHEN_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
}

/** Recent stock movements, newest first, so a wrong count can be traced. */
export default function StockHistoryCard({ productId }: StockHistoryCardProps) {
  // Hooks
  const formCopy = useCopy(productFormContent)
  const fmt = useFormat()
  const [rows, setRows] = useState<Adjustment[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.products
      .adjustments({ productId, limit: 20 })
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [productId])

  // Render logic
  const copy = formCopy.history
  const when = new Intl.DateTimeFormat(fmt.intl, WHEN_OPTIONS)
  const reasonLabels = Object.fromEntries(formCopy.inventory.reasons.map((r) => [r.value, r.label]))

  return (
    <DataCard title={copy.heading}>
      {rows === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ScrollSection
          id={`stock-history-${productId}`}
          label={copy.heading}
          count={rows.length}
          maxHeight="min(24rem, 55vh)"
        >
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-border-soft border-b py-2 last:border-b-0"
              >
                <span className="truncate text-body-strong">{row.variantTitle}</span>
                <span
                  className={
                    row.delta > 0
                      ? 'text-body-strong text-success tabular-nums'
                      : 'text-body-strong text-destructive tabular-nums'
                  }
                >
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
                <span className="text-caption text-muted-foreground">
                  {when.format(new Date(row.createdAt))} ·{' '}
                  {row.actorName ? copy.by(row.actorName) : copy.bySystem}
                </span>
                <span className="text-caption text-muted-foreground">
                  {reasonLabels[row.reason] ?? row.reason}
                </span>
              </li>
            ))}
          </ul>
        </ScrollSection>
      )}
    </DataCard>
  )
}
