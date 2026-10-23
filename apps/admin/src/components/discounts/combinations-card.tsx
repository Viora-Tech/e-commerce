'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'

type CombinationsCardProps = {
  combinesWith: DiscountFormState['combinesWith']
  onChange: (patch: Partial<DiscountFormState>) => void
}

const CLASSES = ['products', 'order', 'shipping'] as const

/** Shopify's Combinations: which other discount classes this one may stack with. */
export default function CombinationsCard({ combinesWith, onChange }: CombinationsCardProps) {
  // Hooks
  const { combinations: copy } = useCopy(discountFormContent)

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <FieldDescription>{copy.help}</FieldDescription>
        {CLASSES.map((c) => (
          <Field key={c} orientation="horizontal">
            <Checkbox
              id={`combine-${c}`}
              checked={combinesWith[c]}
              onCheckedChange={(v) =>
                onChange({ combinesWith: { ...combinesWith, [c]: Boolean(v) } })
              }
            />
            <FieldLabel htmlFor={`combine-${c}`} className="font-normal">
              {copy[c]}
            </FieldLabel>
          </Field>
        ))}
        <FieldDescription>{copy.both}</FieldDescription>
      </FieldGroup>
    </DataCard>
  )
}
