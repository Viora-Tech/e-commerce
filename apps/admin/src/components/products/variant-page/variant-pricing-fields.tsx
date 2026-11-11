'use client'

import { TrendingUp } from '@commerce/ui/icons'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { margin, type VariantRow } from '../form-state'
import ZeroPriceWarning from '../zero-price-warning'
import SwitchRow from './switch-row'

type VariantPricingFieldsProps = {
  draft: VariantRow
  onPatch: (patch: Partial<VariantRow>) => void
}

/** The variant page's Pricing card: price, MRP, cost with the margin it leaves, and "Charge tax". */
export default function VariantPricingFields({ draft, onPatch }: VariantPricingFieldsProps) {
  // Hooks
  const { pricing } = useCopy(productFormContent)
  const fmt = useFormat()

  // Render logic
  const profit = margin(draft.price, draft.cost)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <KitField label={pricing.price} htmlFor="variant-price" help={pricing.priceHelp}>
          <MoneyInput
            size="kit"
            id="variant-price"
            value={draft.price}
            onChange={(price) => onPatch({ price })}
          />
        </KitField>
        <KitField label={`${pricing.mrp} ${pricing.mrpOptional}`} htmlFor="variant-mrp">
          <MoneyInput
            size="kit"
            id="variant-mrp"
            value={draft.mrp}
            onChange={(mrp) => onPatch({ mrp })}
          />
        </KitField>
        <KitField label={pricing.cost} htmlFor="variant-cost" help={pricing.costHelp}>
          <MoneyInput
            size="kit"
            id="variant-cost"
            value={draft.cost}
            onChange={(cost) => onPatch({ cost })}
          />
        </KitField>
      </div>
      <ZeroPriceWarning variant={draft} />
      {profit ? (
        <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-body text-success">
          <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
          {pricing.margin(`${profit.pct}%`, fmt.money(profit.profitPaise))}
        </p>
      ) : null}
      <SwitchRow
        id="variant-taxable"
        label={pricing.taxable}
        help={pricing.taxableHelp}
        checked={draft.taxable}
        onChange={(taxable) => onPatch({ taxable })}
      />
    </div>
  )
}
