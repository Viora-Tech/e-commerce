'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent, rupees } from '@/data/products'
import { formatPaise } from '@/lib/money'
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

const copy = productFormContent.pricing

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
  // Render logic
  const saving = savingPaise(variant.price, variant.mrp)
  const mrpBelow =
    rupees.toPaise(variant.mrp) != null &&
    rupees.toPaise(variant.price) != null &&
    saving === null &&
    variant.mrp.trim() !== ''

  return (
    <div className="flex flex-col gap-6">
      <KitField label={copy.price} htmlFor="variant-price" required>
        <div className="flex h-12 items-center gap-2 rounded-lg border border-secondary bg-background pr-3 focus-within:bg-card">
          <MoneyInput
            size="kit"
            id="variant-price"
            value={variant.price}
            onChange={(price) => onVariant({ price })}
            className="flex-1 border-0 bg-transparent"
          />
          <span className="shrink-0 border-secondary border-l pl-3 text-kit-body text-muted-foreground">
            {copy.currency}
          </span>
        </div>
      </KitField>

      <div className="flex flex-col gap-6 md:flex-row md:gap-5">
        <KitField
          label={copy.mrp}
          htmlFor="variant-mrp"
          help={mrpBelow ? copy.mrpBelowPrice : undefined}
        >
          <div className="flex h-12 items-center gap-2 rounded-lg border border-secondary bg-background pr-3 focus-within:bg-card">
            <MoneyInput
              size="kit"
              id="variant-mrp"
              value={variant.mrp}
              onChange={(mrp) => onVariant({ mrp })}
              className="flex-1 border-0 bg-transparent"
            />
            {saving ? (
              <span className="shrink-0 whitespace-nowrap text-kit-body text-primary">
                {copy.saving(formatPaise(saving))}
              </span>
            ) : null}
          </div>
        </KitField>

        <KitField label={copy.taxIncluded} help={copy.taxIncludedHelp}>
          <RadioGroup
            value={taxIncluded ? 'yes' : 'no'}
            onValueChange={(value) => onTaxIncluded(value === 'yes')}
            className="flex h-12 flex-col justify-center gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tax-included-yes" value="yes" />
              <label htmlFor="tax-included-yes" className="text-kit-field text-ink-strong">
                {copy.taxIncludedYes}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tax-included-no" value="no" />
              <label htmlFor="tax-included-no" className="text-kit-field text-muted-foreground">
                {copy.taxIncludedNo}
              </label>
            </div>
          </RadioGroup>
        </KitField>
      </div>

      <KitField label={copy.expiration} help={copy.expirationHelp}>
        <div className="flex flex-col gap-5 md:flex-row">
          <Input
            size="kit"
            type="date"
            aria-label={copy.expirationStart}
            value={saleStartsAt}
            onChange={(e) => onSaleStartsAt(e.target.value)}
            className="md:flex-1"
          />
          <Input
            size="kit"
            type="date"
            aria-label={copy.expirationEnd}
            value={saleEndsAt}
            onChange={(e) => onSaleEndsAt(e.target.value)}
            className="md:flex-1"
          />
        </div>
      </KitField>
    </div>
  )
}
