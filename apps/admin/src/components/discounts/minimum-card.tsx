'use client'

import { Field, FieldDescription, FieldError, FieldGroup } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import RadioOption from '@/components/fields/radio-option'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'

type MinimumCardProps = {
  form: Pick<DiscountFormState, 'minimum' | 'minSubtotal' | 'minQuantity'>
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

/** Shopify's minimum purchase requirements: none, an amount, or a number of items. */
export default function MinimumCard({ form, error, onChange }: MinimumCardProps) {
  // Hooks
  const { minimum: copy } = useCopy(discountFormContent)

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <RadioGroup
          value={form.minimum}
          onValueChange={(v) => onChange({ minimum: v as DiscountFormState['minimum'] })}
          className="gap-2"
        >
          <RadioOption id="min-none" value="none" label={copy.none} />
          <RadioOption id="min-amount" value="amount" label={copy.subtotal} />
          <RadioOption id="min-quantity" value="quantity" label={copy.quantity} />
        </RadioGroup>
        {form.minimum === 'amount' ? (
          <Field data-invalid={error ? true : undefined} className="max-w-xs">
            <MoneyInput
              size="lg"
              aria-label={copy.subtotal}
              value={form.minSubtotal}
              onChange={(minSubtotal) => onChange({ minSubtotal })}
              invalid={error ? true : undefined}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>{copy.subtotalHelp}</FieldDescription>
            )}
          </Field>
        ) : null}
        {form.minimum === 'quantity' ? (
          <Field data-invalid={error ? true : undefined} className="max-w-xs">
            <Input
              size="lg"
              type="number"
              inputMode="numeric"
              min={1}
              aria-label={copy.quantity}
              value={form.minQuantity}
              onChange={(e) => onChange({ minQuantity: e.target.value })}
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>{copy.quantityHelp}</FieldDescription>
            )}
          </Field>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
