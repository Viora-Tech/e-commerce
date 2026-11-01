'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import DateField from '@/components/fields/date-field'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignFormState } from './campaign-form-state'

type CampaignTermsCardProps = {
  form: CampaignFormState
  disabled: boolean
  /** Which card (audit #34): ship date and limit, or how it is paid. */
  section: 'shipping' | 'payment'
  onChange: (patch: Partial<CampaignFormState>) => void
}

const MODES = ['full', 'fixed', 'percentage'] as const

const asMode = (value: unknown): CampaignFormState['paymentMode'] =>
  MODES.find((m) => m === value) ?? 'full'

/** What every product in the campaign takes (#142): ship date, limit, and how it is paid. */
export default function CampaignTermsCard({
  form,
  disabled,
  section,
  onChange,
}: CampaignTermsCardProps) {
  // Hooks
  const { form: copy } = useCopy(preordersContent)

  // Render logic
  const modeLabel = {
    full: copy.paymentFull,
    fixed: copy.paymentFixed,
    percentage: copy.paymentPercentage,
  }

  if (section === 'shipping') {
    return (
      <DataCard title={copy.shipping}>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="campaign-ship-date">{copy.shipDate}</FieldLabel>
              <DateField
                id="campaign-ship-date"
                value={form.shipDate}
                disabled={disabled}
                onChange={(v) => onChange({ shipDate: v })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-ships-in">{copy.shipsInDays}</FieldLabel>
              <Input
                id="campaign-ships-in"
                type="number"
                min={0}
                value={form.shipsInDays}
                disabled={disabled}
                onChange={(e) => onChange({ shipsInDays: e.target.value })}
              />
              <FieldDescription>{copy.shipsInDaysHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-limit">{copy.limit}</FieldLabel>
              <Input
                id="campaign-limit"
                type="number"
                min={1}
                value={form.limit}
                disabled={disabled}
                onChange={(e) => onChange({ limit: e.target.value })}
              />
              <FieldDescription>{copy.limitHelp}</FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </DataCard>
    )
  }

  return (
    <DataCard title={copy.payment}>
      <FieldGroup>
        <Field>
          <FieldLabel className="sr-only">{copy.payment}</FieldLabel>
          <RadioGroup
            value={form.paymentMode}
            disabled={disabled}
            onValueChange={(v) => onChange({ paymentMode: asMode(v) })}
            className="flex flex-col gap-2"
          >
            {MODES.map((mode) => (
              <div key={mode} className="flex flex-wrap items-center gap-3">
                <RadioGroupItem id={`campaign-mode-${mode}`} value={mode} />
                <label htmlFor={`campaign-mode-${mode}`} className="text-body">
                  {modeLabel[mode]}
                </label>
                {mode === 'fixed' && form.paymentMode === 'fixed' ? (
                  <MoneyInput
                    id="campaign-deposit"
                    aria-label={copy.depositAmount}
                    value={form.deposit}
                    disabled={disabled}
                    onChange={(deposit) => onChange({ deposit })}
                    className="w-32"
                  />
                ) : null}
                {mode === 'percentage' && form.paymentMode === 'percentage' ? (
                  <Input
                    id="campaign-deposit-percent"
                    type="number"
                    min={1}
                    max={99}
                    aria-label={copy.depositPercent}
                    value={form.depositPercent}
                    disabled={disabled}
                    onChange={(e) => onChange({ depositPercent: e.target.value })}
                    className="w-24"
                  />
                ) : null}
              </div>
            ))}
          </RadioGroup>
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
