import type { ProductStatus } from '@commerce/core/catalog'
import { cn } from '@commerce/ui/lib/utils'
import { ImageIcon } from 'lucide-react'
import { StatusPill } from '@/components/layout/status-pill'
import { PRODUCT_STATUS_TONE, productsListContent } from '@/data/products'

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <StatusPill tone={PRODUCT_STATUS_TONE[status]}>{productsListContent.status[status]}</StatusPill>
  )
}

type ProductThumbProps = { url: string | null; alt?: string; className?: string }

/** Kit product thumbnail (46px, radius 12) with an icon placeholder when there is no image. */
export function ProductThumb({ url, alt = '', className }: ProductThumbProps) {
  const box = cn('size-[46px] shrink-0 rounded-xl border border-border-soft bg-muted', className)
  if (!url) {
    return (
      <span className={cn(box, 'flex items-center justify-center text-muted-foreground')}>
        <ImageIcon className="size-5" aria-hidden />
      </span>
    )
  }
  return (
    // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
    <img src={url} alt={alt} className={cn(box, 'object-cover')} />
  )
}
