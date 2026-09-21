import type { ProductStatus } from '@commerce/core/catalog'
import { StatusPill } from '@/components/layout/status-pill'
import { PRODUCT_STATUS_TONE, productsListContent } from '@/data/products'

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <StatusPill tone={PRODUCT_STATUS_TONE[status]}>{productsListContent.status[status]}</StatusPill>
  )
}
