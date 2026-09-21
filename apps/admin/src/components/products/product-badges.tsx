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

/* Frame 5:2613: 40px box, Neutal/200 hairline, 4px radius, picture inset to 30px. */
export function ProductThumb({ url, alt = '', className }: ProductThumbProps) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.25rem] border border-secondary bg-card text-muted-foreground',
        className,
      )}
    >
      {url ? (
        // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
        <img src={url} alt={alt} className="size-6 object-contain" />
      ) : (
        <ImageIcon className="size-4" aria-hidden />
      )}
    </span>
  )
}
