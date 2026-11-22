'use client'

import type { CheckoutFields, FieldRequirement } from '@commerce/core/checkout-settings'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import SwitchRow from '@/components/fields/switch-row'
import ChoiceList from '@/components/returns/choice-list'
import { checkoutRulesContent } from '@/data/checkout-rules'
import { checkoutBrandingContent } from '@/data/checkout-settings'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'

type CheckoutFieldsCardProps = {
  fields: CheckoutFields
  /** The "Company name and GSTIN" box for business buyers. */
  gstin: boolean
  onChange: (fields: CheckoutFields) => void
  onGstin: (on: boolean) => void
}

const REQUIREMENTS: readonly FieldRequirement[] = ['hidden', 'optional', 'required']

const requirementOf = (v: string): FieldRequirement =>
  v === 'optional' || v === 'required' ? v : 'hidden'

/** Settings → Checkout → Form fields (#154): name format, company name and address line 2. */
export default function CheckoutFieldsCard({
  fields,
  gstin,
  onChange,
  onGstin,
}: CheckoutFieldsCardProps) {
  // Hooks
  const { fields: copy } = useCopy(checkoutRulesContent)
  const { shown } = useCopy(checkoutBrandingContent)

  // Render logic
  const requirementChoices = REQUIREMENTS.map((value) => ({
    value,
    ...copy.requirement[value],
  }))

  return (
    <SettingsCard title={copy.heading} description={copy.description}>
      <FieldGroup>
        <Field>
          <FieldLabel>{copy.name}</FieldLabel>
          <ChoiceList
            name="checkout-name-format"
            value={fields.name}
            onChange={(v) => onChange({ ...fields, name: v === 'split' ? 'split' : 'full' })}
            choices={[
              { value: 'full', ...copy.nameChoices.full },
              { value: 'split', ...copy.nameChoices.split },
            ]}
          />
        </Field>
        <Field>
          <FieldLabel>{copy.company}</FieldLabel>
          <FieldDescription>{copy.companyHint}</FieldDescription>
          <ChoiceList
            name="checkout-company"
            value={fields.company}
            onChange={(v) => onChange({ ...fields, company: requirementOf(v) })}
            choices={requirementChoices}
          />
        </Field>
        <SwitchRow
          id="checkout-gstin"
          label={shown.gstin}
          description={shown.gstinHint}
          checked={gstin}
          onChange={onGstin}
          weight="semibold"
          divided
        />
        <Field>
          <FieldLabel>{copy.line2}</FieldLabel>
          <ChoiceList
            name="checkout-line2"
            value={fields.line2}
            onChange={(v) => onChange({ ...fields, line2: requirementOf(v) })}
            choices={requirementChoices}
          />
        </Field>
      </FieldGroup>
    </SettingsCard>
  )
}
