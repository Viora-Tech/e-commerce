import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import ProductThumb from '@/components/products/product-thumb'

type LineItemRowProps = {
  imageUrl: string | null
  title: string
  /** The line under the title: variant, quantity, notes ("Red / M · 2 returned"). */
  subtitle?: ReactNode
  /** A muted column before the amount, e.g. "× 2". */
  quantity?: ReactNode
  /** Inputs before the amount (quantity, price) on editable lines. */
  controls?: ReactNode
  /** The right-hand value, usually the line total. */
  amount?: ReactNode
  /** Anything after the amount (a menu, a stepper). */
  aside?: ReactNode
  className?: string
}

/** One product line (thumb, title, subtitle, quantity, amount) for every items list. */
export default function LineItemRow({
  imageUrl,
  title,
  subtitle,
  quantity,
  controls,
  amount,
  aside,
  className,
}: LineItemRowProps) {
  return (
    <li className={cn('flex items-center gap-3 py-3 first:pt-0 last:pb-0', className)}>
      <ProductThumb url={imageUrl} alt={title} className="size-10" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong text-foreground">{title}</span>
        {subtitle ? (
          <span className="truncate text-caption text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {quantity !== undefined ? (
        <span className="text-caption text-muted-foreground tabular-nums">{quantity}</span>
      ) : null}
      {controls}
      {amount !== undefined ? (
        <span className="w-24 text-end font-medium tabular-nums">{amount}</span>
      ) : null}
      {aside}
    </li>
  )
}
