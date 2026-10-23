'use client'

import { stockStateOf } from '@commerce/core/catalog'
import { TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { productBannerContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { ProductFormState } from './form-state'

type ProductBannerProps = {
  form: ProductFormState
  onUpdateInventory: () => void
  onSetStatus: (status: 'active') => void
  /** The store's low-stock threshold (`products.facets`). */
  lowStockThreshold: number
}

/** The one next step above a saved product: out of stock, running low, draft or archived. */
export default function ProductBanner({
  form,
  onUpdateInventory,
  onSetStatus,
  lowStockThreshold,
}: ProductBannerProps) {
  // Hooks
  const copy = useCopy(productBannerContent)

  // Render logic
  const tracked = form.variants.filter((v) => v.trackInventory)
  const quantities = tracked.map((v) => Number(v.quantity) || 0)
  const total = quantities.reduce((n, q) => n + q, 0)
  const lowIndex = tracked.findIndex((v) => {
    const available = Number(v.quantity) || 0
    return stockStateOf({ trackInventory: true, available }, lowStockThreshold) === 'low'
  })
  const lowVariant = lowIndex === -1 ? null : tracked[lowIndex]

  let banner: { heading: string; body: string; action: string; onAction: () => void } | null = null
  if (form.status === 'archived') {
    banner = { ...copy.archived, onAction: () => onSetStatus('active') }
  } else if (form.status === 'draft') {
    banner = { ...copy.draft, onAction: () => onSetStatus('active') }
  } else if (tracked.length > 0 && total === 0) {
    banner = { ...copy.out, onAction: onUpdateInventory }
  } else if (lowVariant) {
    const what = lowVariant.optionValues.filter(Boolean).join(' / ') || form.title
    banner = {
      heading: copy.low.heading(what),
      body: copy.low.body(Number(lowVariant.quantity) || 0, total),
      action: copy.low.action,
      onAction: onUpdateInventory,
    }
  }
  if (!banner) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-warning"
    >
      <TriangleAlert className="size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-semibold text-foreground">{banner.heading}</span>
        <span className="text-caption text-muted-foreground">{banner.body}</span>
      </div>
      <Button variant="outline" size="sm" onClick={banner.onAction}>
        {banner.action}
      </Button>
    </div>
  )
}
