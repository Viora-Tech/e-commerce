'use client'

import { TrendingUp } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'
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
        <Field>
          <FieldLabel htmlFor="variant-price">{pricing.price}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-price"
            value={draft.price}
            onChange={(price) => onPatch({ price })}
          />
          <FieldDescription>{pricing.priceHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="variant-mrp">{`${pricing.mrp} ${pricing.mrpOptional}`}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-mrp"
            value={draft.mrp}
            onChange={(mrp) => onPatch({ mrp })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="variant-cost">{pricing.cost}</FieldLabel>
          <MoneyInput
            size="kit"
            id="variant-cost"
            value={draft.cost}
            onChange={(cost) => onPatch({ cost })}
          />
          <FieldDescription>{pricing.costHelp}</FieldDescription>
        </Field>
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
