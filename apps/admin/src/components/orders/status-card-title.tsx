import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { CHIP_SOFT, type ChipTone } from '@/components/status/tone'

type StatusCardTitleProps = {
  /** The status glyph, drawn in a small tinted square on the left of the title. */
  icon: ReactNode
  tone: ChipTone
  children: ReactNode
}

/**
 * The title of an order status card (Unfulfilled, Fulfilled, Payment): a tinted status glyph
 * on the left, as on Shopify's order page, so these stand out from the info cards around them.
 * Goes in `DataCard`'s `title`.
 */
export default function StatusCardTitle({ icon, tone, children }: StatusCardTitleProps) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md border [&_svg]:size-3.5',
          CHIP_SOFT[tone],
        )}
      >
        {icon}
      </span>
      {children}
    </span>
  )
}
