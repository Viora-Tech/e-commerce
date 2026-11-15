'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import LoadFailed from '@/components/states/load-failed'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Sales = Awaited<ReturnType<typeof api.products.sales>>

type ProductSalesCardProps = {
  productId: string
  /** The orders list's Product filter matches line titles, so the link filters by it. */
  productTitle: string
}

/** The orders list filtered to this product over the card's window (`date=90d`). */
function ordersHref(title: string): string {
  const params = new URLSearchParams({ product: title.trim(), date: '90d' })
  return `${routes.orders.list()}?${params.toString()}`
}

/**
 * "Sales past 90 days" (#56): units sold, buyers and net revenue, by the reports' rules (no
 * drafts, test or cancelled orders), with a link to those orders.
 */
export default function ProductSalesCard({ productId, productTitle }: ProductSalesCardProps) {
  // Hooks
  const { sales: copy } = useCopy(productFormContent)
  const fmt = useFormat()
  const {
    data: sales,
    failed,
    retry,
  } = useLoad<Sales>(() => api.products.sales({ productId }), [productId])

  // Early returns
  // A role without sales access sees no card, as before; any other failure offers Try again.
  if (failed === 'no-access') return null

  // Render logic
  const stats = sales
    ? [
        { label: copy.units, value: fmt.number(sales.units) },
        { label: copy.buyers, value: fmt.number(sales.buyers) },
        { label: copy.net, value: fmt.moneyWhole(sales.netPaise) },
      ]
    : []

  return (
    <DataCard
      title={copy.heading(sales?.days ?? 90)}
      footer={
        sales && sales.orders > 0 && productTitle.trim() ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={ordersHref(productTitle)} />}
          >
            {copy.viewOrders(sales.orders)}
          </Button>
        ) : undefined
      }
    >
      {failed ? (
        <LoadFailed failed={failed} onRetry={retry} size="inline" />
      ) : sales === null ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : sales.orders === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="truncate text-caption text-muted-foreground">{s.label}</dt>
              <dd className="truncate text-body-strong text-ink-strong tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </DataCard>
  )
}
