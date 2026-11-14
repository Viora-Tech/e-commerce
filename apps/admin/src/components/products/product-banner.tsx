'use client'

import { stockStateOf } from '@commerce/core/catalog'
import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
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
  // A pre-order keeps selling at 0: "Shoppers cannot buy it until you add stock" would be wrong.
  const sellsOnPreorder =
    form.preorderEnabled ||
    form.preorderCampaignId !== null ||
    tracked.some((v) => v.preorderAllowed)

  let banner: { heading: string; body: string; action: string; onAction: () => void } | null = null
  if (form.status === 'archived') {
    banner = { ...copy.archived, onAction: () => onSetStatus('active') }
  } else if (form.status === 'draft') {
    banner = { ...copy.draft, onAction: () => onSetStatus('active') }
  } else if (tracked.length > 0 && total === 0 && !sellsOnPreorder) {
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
    <Alert
      tone="warning"
      role="status"
      action={
        <Button variant="outline" size="sm" onClick={banner.onAction}>
          {banner.action}
        </Button>
      }
    >
      <TriangleAlert aria-hidden />
      <AlertTitle className="text-body">{banner.heading}</AlertTitle>
      <AlertDescription className="text-caption">{banner.body}</AlertDescription>
    </Alert>
  )
}
