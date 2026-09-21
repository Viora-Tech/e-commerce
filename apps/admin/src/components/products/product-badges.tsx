import type { ProductStatus } from '@commerce/core/catalog'
import { Badge } from '@commerce/ui/shadcn/badge'
import { ImageIcon } from 'lucide-react'
import { PRODUCT_STATUS_TONE, productsListContent } from '@/data/products'

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge variant={PRODUCT_STATUS_TONE[status]}>{productsListContent.status[status]}</Badge>
}

type ProductThumbProps = { url: string | null; alt?: string }

/** 40px square thumbnail with an icon placeholder when the product has no image. */
export function ProductThumb({ url, alt = '' }: ProductThumbProps) {
  if (!url) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageIcon className="size-4" aria-hidden />
      </span>
    )
  }
  return (
    // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
    <img src={url} alt={alt} className="size-10 shrink-0 rounded-md border bg-muted object-cover" />
  )
}
