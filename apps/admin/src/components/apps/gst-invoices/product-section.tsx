'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ProductSectionProps } from '@/apps/product-sections'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'

/**
 * The GST invoices app on a product's More tab: the HSN code and GST rate its invoices print
 * (the app's `productFields`), with a jump to where they are edited on the Shipping tab.
 */
export default function ProductSection({ variants, onOpenTab }: ProductSectionProps) {
  // Hooks
  const { gst: copy } = useCopy(productPageContent)

  // Render logic
  const first = variants[0]
  const hsCode = first?.hsCode.trim()
  const gstRate = first?.gstRate.trim()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-muted-foreground">{copy.help}</p>
      <dl className="grid grid-cols-2 gap-3 sm:max-w-[25rem]">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{copy.hsCode}</dt>
          <dd className="text-body-strong tabular-nums">{hsCode || copy.notSet}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{copy.gstRate}</dt>
          <dd className="text-body-strong tabular-nums">
            {gstRate ? copy.rate(gstRate) : copy.storeRate}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-end"
        onClick={() => onOpenTab('shipping', 'variant-hs')}
      >
        <Pencil aria-hidden="true" />
        {copy.edit}
      </Button>
    </div>
  )
}
