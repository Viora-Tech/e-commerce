'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import RadioOption from '@/components/fields/radio-option'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { INDIAN_STATES } from '@/data/india'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'

type ShippingCardProps = {
  form: Pick<DiscountFormState, 'allStates' | 'shippingStates' | 'excludeRates' | 'maxShipping'>
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

/** Free shipping: every state or ticked ones, and Shopify's "exclude rates over" cap. */
export default function ShippingCard({ form, error, onChange }: ShippingCardProps) {
  // Hooks
  const { shipping: copy } = useCopy(discountFormContent)

  // Event handlers
  const handleState = (code: string, on: boolean) =>
    onChange({
      shippingStates: on
        ? [...form.shippingStates.filter((c) => c !== code), code]
        : form.shippingStates.filter((c) => c !== code),
    })

  return (
    <>
      <DataCard title={copy.heading}>
        <FieldGroup>
          <RadioGroup
            value={form.allStates ? 'all' : 'some'}
            onValueChange={(v) => onChange({ allStates: v === 'all' })}
            className="gap-2"
          >
            <RadioOption id="ship-all" value="all" label={copy.allStates} />
            <RadioOption id="ship-some" value="some" label={copy.selectedStates} />
          </RadioGroup>
          {form.allStates ? null : (
            <Field data-invalid={error ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption" aria-live="polite">
                  {copy.statesPicked(form.shippingStates.length)}
                </span>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onChange({ shippingStates: INDIAN_STATES.map((s) => s.code) })}
                  >
                    {copy.selectAll}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onChange({ shippingStates: [] })}
                  >
                    {copy.clear}
                  </Button>
                </span>
              </div>
              <ul className="grid max-h-72 gap-x-4 gap-y-2 overflow-y-auto overscroll-contain rounded-lg border border-border p-3 sm:grid-cols-2">
                {INDIAN_STATES.map((s) => (
                  <li key={s.code}>
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`ship-state-${s.code}`}
                        checked={form.shippingStates.includes(s.code)}
                        onCheckedChange={(v) => handleState(s.code, Boolean(v))}
                      />
                      <FieldLabel
                        htmlFor={`ship-state-${s.code}`}
                        className="text-body font-normal"
                      >
                        {s.name}
                      </FieldLabel>
                    </Field>
                  </li>
                ))}
              </ul>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )}
        </FieldGroup>
      </DataCard>

      <DataCard title={copy.ratesHeading}>
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox
              id="ship-exclude"
              checked={form.excludeRates}
              onCheckedChange={(v) => onChange({ excludeRates: Boolean(v) })}
            />
            <FieldLabel htmlFor="ship-exclude" className="font-normal">
              {copy.exclude}
            </FieldLabel>
          </Field>
          {form.excludeRates ? (
            <Field className="max-w-xs">
              <FieldLabel htmlFor="ship-max">{copy.maxRate}</FieldLabel>
              <MoneyInput
                size="lg"
                id="ship-max"
                value={form.maxShipping}
                onChange={(maxShipping) => onChange({ maxShipping })}
              />
              <FieldDescription>{copy.maxRateHelp}</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
      </DataCard>
    </>
  )
}
