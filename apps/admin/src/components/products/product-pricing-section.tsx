'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent, rupees } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { VariantRow } from './form-state'

type ProductPricingSectionProps = {
  variant: VariantRow
  taxIncluded: boolean
  saleStartsAt: string
  saleEndsAt: string
  onVariant: (patch: Partial<VariantRow>) => void
  onTaxIncluded: (value: boolean) => void
  onSaleStartsAt: (value: string) => void
  onSaleEndsAt: (value: string) => void
}

/** Rupees saved against the compare-at price, or null when there is nothing to show. */
function savingPaise(price: string, mrp: string): number | null {
  const p = rupees.toPaise(price)
  const m = rupees.toPaise(mrp)
  if (p == null || m == null || m <= p) return null
  return m - p
}

/**
 * Frame 5:5166, 5:5134 and 5:5154: full-width price with a currency plate,
 * then compare-at beside the tax choice, then the two date fields.
 */
export default function ProductPricingSection({
  variant,
  taxIncluded,
  saleStartsAt,
  saleEndsAt,
  onVariant,
  onTaxIncluded,
  onSaleStartsAt,
  onSaleEndsAt,
}: ProductPricingSectionProps) {
  // Hooks
  const { pricing: copy } = useCopy(productFormContent)
  const fmt = useFormat()

  // Render logic
  const saving = savingPaise(variant.price, variant.mrp)
  const mrpBelow =
    rupees.toPaise(variant.mrp) != null &&
    rupees.toPaise(variant.price) != null &&
    saving === null &&
    variant.mrp.trim() !== ''

  return (
    <div className="flex flex-col gap-4">
      <KitField label={copy.price} htmlFor="variant-price" required>
        <MoneyInput
          size="kit"
          id="variant-price"
          value={variant.price}
          onChange={(price) => onVariant({ price })}
          suffix={copy.currency}
        />
      </KitField>

      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <KitField
          label={copy.mrp}
          htmlFor="variant-mrp"
          help={mrpBelow ? copy.mrpBelowPrice : undefined}
        >
          <MoneyInput
            size="kit"
            id="variant-mrp"
            value={variant.mrp}
            onChange={(mrp) => onVariant({ mrp })}
            suffix={saving ? copy.saving(fmt.money(saving)) : undefined}
          />
        </KitField>

        <KitField label={copy.taxIncluded} help={copy.taxIncludedHelp}>
          <RadioGroup
            value={taxIncluded ? 'yes' : 'no'}
            onValueChange={(value) => onTaxIncluded(value === 'yes')}
            className="flex h-9 flex-col justify-center gap-1.5"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tax-included-yes" value="yes" />
              <label htmlFor="tax-included-yes" className="text-body text-foreground">
                {copy.taxIncludedYes}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tax-included-no" value="no" />
              <label htmlFor="tax-included-no" className="text-body text-muted-foreground">
                {copy.taxIncludedNo}
              </label>
            </div>
          </RadioGroup>
        </KitField>
      </div>

      <KitField label={copy.expiration} help={copy.expirationHelp}>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-1.5 md:flex-1">
            <label htmlFor="sale-starts-at" className="text-caption text-muted-foreground">
              {copy.expirationStart}
            </label>
            <Input
              id="sale-starts-at"
              size="kit"
              type="date"
              value={saleStartsAt}
              onChange={(e) => onSaleStartsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:flex-1">
            <label htmlFor="sale-ends-at" className="text-caption text-muted-foreground">
              {copy.expirationEnd}
            </label>
            <Input
              id="sale-ends-at"
              size="kit"
              type="date"
              value={saleEndsAt}
              onChange={(e) => onSaleEndsAt(e.target.value)}
            />
          </div>
        </div>
      </KitField>
    </div>
  )
}
