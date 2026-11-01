'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { ProductTax } from './product-tax'

type ProductTaxFieldsProps = {
  tax: ProductTax
  /** No options: one variant, so "Different per variant" has nothing to differ. */
  singleVariant: boolean
  /** Which fields: the HSN code and per-variant switch (Shipping), the GST rate (beside
   *  "Charge tax", audit #135), or all of them. */
  part?: 'customs' | 'rate' | 'all'
  onChange: (tax: ProductTax) => void
}

/** Two digits at most: GST slabs run 0 to 40. */
const rateText = (text: string) => text.replace(/\D/g, '').slice(0, 2)

/**
 * HSN code and GST rate set once for the whole product (#63), with "Different per variant" for
 * the rare product whose variants are classed differently. `product-hs` is the field the
 * "No HS code" checklist row and the GST app jump to.
 */
export default function ProductTaxFields({
  tax,
  singleVariant,
  part = 'all',
  onChange,
}: ProductTaxFieldsProps) {
  // Hooks
  const { shipping: copy } = useCopy(productFormContent)

  // Render logic
  const customs = part !== 'rate'
  const rate = part !== 'customs'

  return (
    <>
      {customs || rate ? (
        <div className="grid gap-4 md:grid-cols-2">
          {customs ? (
            <KitField
              label={copy.hsCode}
              help={singleVariant ? copy.hsCodeHelp : copy.hsCodeAllHelp}
              htmlFor="product-hs"
            >
              <Input
                size="kit"
                id="product-hs"
                value={tax.hsCode}
                onChange={(e) => onChange({ ...tax, hsCode: e.target.value })}
                autoComplete="off"
                inputMode="numeric"
              />
            </KitField>
          ) : null}
          {rate ? (
            <KitField label={copy.gstRate} help={copy.gstRateHelp} htmlFor="product-gst">
              <Input
                size="kit"
                id="product-gst"
                value={tax.gstRate}
                onChange={(e) => onChange({ ...tax, gstRate: rateText(e.target.value) })}
                autoComplete="off"
                inputMode="numeric"
              />
            </KitField>
          ) : null}
        </div>
      ) : null}
      {singleVariant || !customs ? null : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="product-tax-per-variant" className="text-body-strong text-foreground">
              {copy.taxPerVariant}
            </label>
            <p className="text-caption text-muted-foreground">
              {tax.perVariant ? copy.taxPerVariantOnHelp : copy.taxPerVariantOffHelp}
            </p>
          </div>
          <Switch
            id="product-tax-per-variant"
            checked={tax.perVariant}
            onCheckedChange={(perVariant) => onChange({ ...tax, perVariant })}
          />
        </div>
      )}
    </>
  )
}
