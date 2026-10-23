'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'

type UsageCardProps = {
  form: Pick<DiscountFormState, 'limitTotal' | 'usageLimit' | 'onePerCustomer'>
  onChange: (patch: Partial<DiscountFormState>) => void
}

/** Maximum discount uses: a total cap and one use per customer. */
export default function UsageCard({ form, onChange }: UsageCardProps) {
  // Hooks
  const { usage } = useCopy(discountFormContent)

  return (
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
        {form.onePerCustomer ? <FieldDescription>{usage.perCustomerHelp}</FieldDescription> : null}
      </FieldGroup>
    </DataCard>
  )
}
