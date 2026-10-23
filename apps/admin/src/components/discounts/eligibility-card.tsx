'use client'

import { Field, FieldDescription, FieldError, FieldGroup } from '@commerce/ui/shadcn/field'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import RadioOption from '@/components/fields/radio-option'
import DataCard from '@/components/layout/data-card'
import PickedField from '@/components/pickers/picked-field'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState } from './form-state'
import { loadPeople, type PeopleKind, peopleTab } from './pick-sources'

type EligibilityCardProps = {
  form: Pick<DiscountFormState, 'eligibility' | 'segmentIds' | 'customerIds'>
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

/** Shopify's customer eligibility: everyone, picked segments, or picked customers. */
export default function EligibilityCard({ form, error, onChange }: EligibilityCardProps) {
  // Hooks
  const { eligibility: copy } = useCopy(discountFormContent)

  // Event handlers
  const handlePicked = ({ kind, ids }: { kind: string; ids: string[] }) =>
    onChange(kind === 'segments' ? { segmentIds: ids } : { customerIds: ids })

  // Render logic
  const kind: PeopleKind | null = form.eligibility === 'all' ? null : form.eligibility

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <RadioGroup
          value={form.eligibility}
          onValueChange={(v) => onChange({ eligibility: v as DiscountFormState['eligibility'] })}
          className="gap-2"
        >
          <RadioOption id="who-all" value="all" label={copy.all} />
          <RadioOption id="who-segments" value="segments" label={copy.segments} />
          <RadioOption id="who-customers" value="customers" label={copy.customers} />
        </RadioGroup>
        {kind ? (
          <Field data-invalid={error ? true : undefined}>
            <PickedField
              key={kind}
              kind={kind}
              ids={kind === 'segments' ? form.segmentIds : form.customerIds}
              tabs={[peopleTab(kind, copy)]}
              title={kind === 'segments' ? copy.segmentPicker : copy.customerPicker}
              search={kind === 'segments' ? copy.segmentSearch : copy.customerSearch}
              labels={copy}
              loadPicked={(k, ids) => loadPeople(k as PeopleKind, ids, copy)}
              onChange={handlePicked}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>{copy.checkedAt}</FieldDescription>
            )}
          </Field>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
