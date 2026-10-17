'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import type { DiscountFormState } from './form-state'

type DatesCardProps = {
  form: Pick<DiscountFormState, 'startsAt' | 'hasEnd' | 'endsAt'>
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

const copy = discountFormContent.dates

export default function DatesCard({ form, error, onChange }: DatesCardProps) {
  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="discount-start">{copy.start}</FieldLabel>
            <Input
              size="lg"
              id="discount-start"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => onChange({ startsAt: e.target.value })}
            />
          </Field>
          {form.hasEnd ? (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="discount-end">{copy.end}</FieldLabel>
              <Input
                size="lg"
                id="discount-end"
                type="datetime-local"
                value={form.endsAt}
                min={form.startsAt || undefined}
                onChange={(e) => onChange({ endsAt: e.target.value })}
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
