'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import SwitchRow from '@/components/fields/switch-row'
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
            <Field>
              <FieldLabel htmlFor="product-hs">{copy.hsCode}</FieldLabel>
              <Input
                size="kit"
                id="product-hs"
                value={tax.hsCode}
                onChange={(e) => onChange({ ...tax, hsCode: e.target.value })}
                autoComplete="off"
                inputMode="numeric"
              />
              <FieldDescription>
                {singleVariant ? copy.hsCodeHelp : copy.hsCodeAllHelp}
              </FieldDescription>
            </Field>
          ) : null}
          {rate ? (
            <Field>
              <FieldLabel htmlFor="product-gst">{copy.gstRate}</FieldLabel>
              <Input
                size="kit"
                id="product-gst"
                value={tax.gstRate}
                onChange={(e) => onChange({ ...tax, gstRate: rateText(e.target.value) })}
                autoComplete="off"
                inputMode="numeric"
              />
              <FieldDescription>{copy.gstRateHelp}</FieldDescription>
            </Field>
          ) : null}
        </div>
      ) : null}
      {singleVariant || !customs ? null : (
        <SwitchRow
          id="product-tax-per-variant"
          label={copy.taxPerVariant}
          description={tax.perVariant ? copy.taxPerVariantOnHelp : copy.taxPerVariantOffHelp}
          checked={tax.perVariant}
          onChange={(perVariant) => onChange({ ...tax, perVariant })}
          weight="normal"
        />
      )}
    </>
  )
}
