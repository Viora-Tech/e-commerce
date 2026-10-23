import type { CataloguePrice } from '@commerce/core/app-catalogue'
import { cn } from '@commerce/ui/lib/utils'
import { priceChip } from '@/data/apps'

type PriceChipProps = { price: CataloguePrice; className?: string }

/** "Free" as a quiet outline, "₹149/month" as a filled chip, so paid apps read at a glance. */
export default function PriceChip({ price, className }: PriceChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums',
        price.kind === 'free'
          ? 'text-muted-foreground ring-1 ring-border ring-inset'
          : 'bg-foreground/10 text-foreground',
        className,
      )}
    >
      {priceChip(price)}
    </span>
  )
}
