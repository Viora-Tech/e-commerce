'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import type { DiscountFormState } from './form-state'

type ConditionsCardProps = {
  form: Pick<
    DiscountFormState,
    'hasMinimum' | 'minSubtotal' | 'limitTotal' | 'usageLimit' | 'onePerCustomer'
  >
  onChange: (patch: Partial<DiscountFormState>) => void
}

const minimum = discountFormContent.minimum
const usage = discountFormContent.usage
const eligibility = discountFormContent.eligibility

/** Minimum requirement, customer eligibility and usage limits in one card, Shopify style. */
export default function ConditionsCard({ form, onChange }: ConditionsCardProps) {
  return (
    <>
      <DataCard title={minimum.heading}>
        <FieldGroup>
          <RadioGroup
            value={form.hasMinimum ? 'subtotal' : 'none'}
            onValueChange={(v) => onChange({ hasMinimum: v === 'subtotal' })}
            className="gap-2"
          >
            <FieldLabel htmlFor="min-none" className="flex items-center gap-2 font-normal">
              <RadioGroupItem id="min-none" value="none" />
              {minimum.none}
            </FieldLabel>
            <FieldLabel htmlFor="min-subtotal" className="flex items-center gap-2 font-normal">
              <RadioGroupItem id="min-subtotal" value="subtotal" />
              {minimum.subtotal}
            </FieldLabel>
          </RadioGroup>
          {form.hasMinimum ? (
            <Field className="max-w-xs">
              <MoneyInput
                size="lg"
                aria-label={minimum.subtotal}
                value={form.minSubtotal}
                onChange={(minSubtotal) => onChange({ minSubtotal })}
              />
              <FieldDescription>{minimum.subtotalHelp}</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
      </DataCard>

      <DataCard title={eligibility.heading}>
        <p className="text-body text-muted-foreground">{eligibility.body}</p>
      </DataCard>

      <DataCard title={usage.heading}>
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox
              id="limit-total"
              checked={form.limitTotal}
              onCheckedChange={(v) => onChange({ limitTotal: Boolean(v) })}
            />
            <FieldLabel htmlFor="limit-total" className="font-normal">
              {usage.total}
            </FieldLabel>
          </Field>
          {form.limitTotal ? (
            <Field className="max-w-xs">
              <FieldLabel htmlFor="usage-limit" className="sr-only">
                {usage.totalLabel}
              </FieldLabel>
              <Input
                size="lg"
                id="usage-limit"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.usageLimit}
                onChange={(e) => onChange({ usageLimit: e.target.value })}
              />
            </Field>
          ) : null}
          <Field orientation="horizontal">
            <Checkbox
              id="one-per-customer"
              checked={form.onePerCustomer}
              onCheckedChange={(v) => onChange({ onePerCustomer: Boolean(v) })}
            />
            <FieldLabel htmlFor="one-per-customer" className="font-normal">
              {usage.perCustomer}
            </FieldLabel>
          </Field>
          {form.onePerCustomer ? (
            <FieldDescription>{usage.perCustomerHelp}</FieldDescription>
          ) : null}
        </FieldGroup>
      </DataCard>
    </>
  )
}
