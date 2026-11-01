'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import DateField from '@/components/fields/date-field'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'

type DatesCardProps = {
  form: Pick<DiscountFormState, 'startsAt' | 'hasEnd' | 'endsAt'>
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

export default function DatesCard({ form, error, onChange }: DatesCardProps) {
  // Hooks
  const { dates: copy } = useCopy(discountFormContent)

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="discount-start">{copy.start}</FieldLabel>
            <DateField
              mode="datetime"
              id="discount-start"
              value={form.startsAt}
              onChange={(v) => onChange({ startsAt: v })}
            />
          </Field>
          {form.hasEnd ? (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="discount-end">{copy.end}</FieldLabel>
              <DateField
                mode="datetime"
                id="discount-end"
                value={form.endsAt}
                min={form.startsAt || undefined}
                onChange={(v) => onChange({ endsAt: v })}
                aria-invalid={error ? true : undefined}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          ) : null}
        </div>
        <Field orientation="horizontal">
          <Checkbox
            id="discount-has-end"
            checked={form.hasEnd}
            onCheckedChange={(v) => onChange({ hasEnd: Boolean(v) })}
          />
          <FieldLabel htmlFor="discount-has-end" className="font-normal">
            {copy.setEnd}
          </FieldLabel>
        </Field>
        <FieldDescription>{copy.tz}</FieldDescription>
      </FieldGroup>
    </DataCard>
  )
}
