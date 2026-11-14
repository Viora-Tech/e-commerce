'use client'

import type { VariantBox } from '@commerce/core/catalog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/product-form'
import { productShippingContent } from '@/data/product-shipping'
import { variantPageContent } from '@/data/variant-page'
import { useCopy } from '@/hooks/use-copy'
import type { VariantRow } from '../form-state'
import type { ProductTax } from '../product-tax'
import SwitchRow from '../switch-row'
import VariantBoxField from '../variant-box-field'
import WeightInput from '../weight-input'

type VariantShippingFieldsProps = {
  draft: VariantRow
  onPatch: (patch: Partial<VariantRow>) => void
  /** The product's HSN and GST rate; the variant edits its own only when `perVariant` (#63). */
  tax: ProductTax
  /** The product's Package, for the variant's optional own box (#1517). */
  productBox: VariantBox
}

const NONE = '__none'

/**
 * The variant page's Shipping card: physical or not, weight, its own box, country of origin, and
 * its own HSN code and GST rate when the product sets them per variant.
 */
export default function VariantShippingFields({
  draft,
  onPatch,
  tax,
  productBox,
}: VariantShippingFieldsProps) {
  // Hooks
  const { shipping } = useCopy(productFormContent)
  const physical = useCopy(productShippingContent)
  const { fields: copy } = useCopy(variantPageContent)

  // Render logic
  const countries = Object.fromEntries([
    [NONE, shipping.countryPlaceholder],
    ...COUNTRIES.map((c) => [c.code, c.name]),
  ])

  return (
    <div className="flex flex-col gap-4">
      <SwitchRow
        id="variant-physical"
        label={physical.physical}
        help={physical.physicalHelp}
        checked={draft.requiresShipping}
        onChange={(requiresShipping) => onPatch({ requiresShipping })}
      />
      {draft.requiresShipping ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="variant-weight">{shipping.weight}</FieldLabel>
            <WeightInput
              id="variant-weight"
              weight={draft.weight}
              unit={draft.weightUnit}
              onChange={onPatch}
            />
            <FieldDescription>{shipping.weightHelp}</FieldDescription>
          </Field>
          <VariantBoxField draft={draft} productBox={productBox} onPatch={onPatch} />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="variant-origin">{shipping.country}</FieldLabel>
          <Select
            items={countries}
            value={draft.countryOfOrigin || NONE}
            onValueChange={(next) =>
              onPatch({ countryOfOrigin: next === NONE ? '' : String(next) })
            }
          >
            <SelectTrigger size="lg" id="variant-origin" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{shipping.countryPlaceholder}</SelectItem>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {tax.perVariant ? (
          <Field>
            <FieldLabel htmlFor="variant-hs">{shipping.hsCode}</FieldLabel>
            <Input
              size="kit"
              id="variant-hs"
              value={draft.hsCode}
              placeholder={tax.hsCode.trim() ? copy.fromProduct(tax.hsCode.trim()) : undefined}
              onChange={(e) => onPatch({ hsCode: e.target.value })}
              autoComplete="off"
              inputMode="numeric"
            />
            <FieldDescription>{shipping.hsCodeHelp}</FieldDescription>
          </Field>
        ) : null}
        {tax.perVariant && draft.taxable ? (
          <Field>
            <FieldLabel htmlFor="variant-gst">{shipping.gstRate}</FieldLabel>
            <Input
              size="kit"
              id="variant-gst"
              value={draft.gstRate}
              placeholder={tax.gstRate.trim() ? copy.fromProduct(tax.gstRate.trim()) : undefined}
              onChange={(e) => onPatch({ gstRate: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              autoComplete="off"
              inputMode="numeric"
            />
            <FieldDescription>{shipping.gstRateHelp}</FieldDescription>
          </Field>
        ) : null}
      </div>
      {tax.perVariant ? null : (
        <p className="text-caption text-muted-foreground">{copy.taxFromProduct}</p>
      )}
    </div>
  )
}
