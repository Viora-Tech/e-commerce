'use client'

import { TrendingUp } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'
import SwitchRow from '@/components/fields/switch-row'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { margin, type VariantRow } from '../form-state'
import ZeroPriceWarning from '../zero-price-warning'

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
        <Alert tone="success">
          <TrendingUp aria-hidden="true" />
          <AlertDescription className="text-body text-foreground">
            {pricing.margin(`${profit.pct}%`, fmt.money(profit.profitPaise))}
          </AlertDescription>
        </Alert>
      ) : null}
      <SwitchRow
        id="variant-taxable"
        label={pricing.taxable}
        description={pricing.taxableHelp}
        checked={draft.taxable}
        onChange={(taxable) => onPatch({ taxable })}
        weight="normal"
      />
    </div>
  )
}
