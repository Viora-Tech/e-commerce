'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { VariantRow } from './form-state'

type ZeroPriceWarningProps = {
  variant: Pick<VariantRow, 'price' | 'hiddenOnStore'>
  className?: string
}

/** True for a variant shoppers can see at ₹0 (#934). A blank price is "no price yet", not ₹0. */
export const showsFree = (v: Pick<VariantRow, 'price' | 'hiddenOnStore'>) =>
  !v.hiddenOnStore && rupees.toPaise(v.price) === 0

/**
 * Admin-only note on a visible variant priced ₹0 (#934). ₹0 is a valid price (free items), so it
 * never blocks a save or a checkout; it only makes sure staff meant it.
 */
export default function ZeroPriceWarning({ variant, className }: ZeroPriceWarningProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Early returns
  if (!showsFree(variant)) return null

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-caption text-warning-foreground dark:text-warning',
        className,
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {copy.variants.zeroPrice}
    </p>
  )
}
