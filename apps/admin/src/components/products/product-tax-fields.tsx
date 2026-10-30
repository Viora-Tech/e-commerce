'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import SettingsRow from '@/components/settings/settings-row'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { ProductTax } from './product-tax'

type ProductTaxFieldsProps = {
  tax: ProductTax
  /** No options: one variant, so "Different per variant" has nothing to differ. */
  singleVariant: boolean
  onChange: (tax: ProductTax) => void
}

/** Two digits at most: GST slabs run 0 to 40. */
const rateText = (text: string) => text.replace(/\D/g, '').slice(0, 2)

/**
 * HSN code and GST rate set once for the whole product (#63), with "Different per variant" for
 * the rare product whose variants are classed differently. `product-hs` is the field the
 * "No HS code" checklist row and the GST app jump to.
 */
export default function ProductTaxFields({ tax, singleVariant, onChange }: ProductTaxFieldsProps) {
  // Hooks
  const { shipping: copy } = useCopy(productFormContent)

  return (
    <>
      <SettingsRow
        label={copy.hsCode}
        description={singleVariant ? copy.hsCodeHelp : copy.hsCodeAllHelp}
        htmlFor="product-hs"
      >
        <Input
          size="lg"
          id="product-hs"
          value={tax.hsCode}
          onChange={(e) => onChange({ ...tax, hsCode: e.target.value })}
          autoComplete="off"
          inputMode="numeric"
          className="md:max-w-[20.75rem]"
        />
      </SettingsRow>
      <SettingsRow label={copy.gstRate} description={copy.gstRateHelp} htmlFor="product-gst">
        <Input
          size="lg"
          id="product-gst"
          value={tax.gstRate}
          onChange={(e) => onChange({ ...tax, gstRate: rateText(e.target.value) })}
          autoComplete="off"
          inputMode="numeric"
          className="md:max-w-[20.75rem]"
        />
      </SettingsRow>
      {singleVariant ? null : (
        <SettingsRow
          label={copy.taxPerVariant}
          description={tax.perVariant ? copy.taxPerVariantOnHelp : copy.taxPerVariantOffHelp}
          htmlFor="product-tax-per-variant"
        >
          <Switch
            id="product-tax-per-variant"
            checked={tax.perVariant}
            onCheckedChange={(perVariant) => onChange({ ...tax, perVariant })}
          />
        </SettingsRow>
      )}
    </>
  )
}
