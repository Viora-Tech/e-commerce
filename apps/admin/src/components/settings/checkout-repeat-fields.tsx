'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'

type RepeatValue = { duplicateCheckoutHours: number; unpaidCheckoutsPerHour: number }

type CheckoutRepeatFieldsProps = {
  value: RepeatValue
  onChange: (next: RepeatValue) => void
}

/** Same bounds as core `PaymentSettingsSchema`: 0 to 168 hours, 0 to 50 orders; 0 is off. */
const MAX_WINDOW_HOURS = 168
const MAX_PER_HOUR = 50

const toCount = (raw: string, max: number): number => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0
}

/** Settings › Payments: the same items checked out again, and the hourly cap of unpaid orders. */
export default function CheckoutRepeatFields({ value, onChange }: CheckoutRepeatFieldsProps) {
  // Hooks
  const copy = useCopy(paymentsSettingsContent)

  return (
    <SettingsCard title={copy.repeats.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="repeat-window">{copy.repeats.windowLabel}</FieldLabel>
          <Input
            size="lg"
            id="repeat-window"
            type="number"
            min={0}
            max={MAX_WINDOW_HOURS}
            value={String(value.duplicateCheckoutHours)}
            onChange={(e) =>
              onChange({
                ...value,
                duplicateCheckoutHours: toCount(e.target.value, MAX_WINDOW_HOURS),
              })
            }
            autoComplete="off"
          />
          <FieldDescription>{copy.repeats.windowHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="repeat-cap">{copy.repeats.capLabel}</FieldLabel>
          <Input
            size="lg"
            id="repeat-cap"
            type="number"
            min={0}
            max={MAX_PER_HOUR}
            value={String(value.unpaidCheckoutsPerHour)}
            onChange={(e) =>
              onChange({ ...value, unpaidCheckoutsPerHour: toCount(e.target.value, MAX_PER_HOUR) })
            }
            autoComplete="off"
          />
          <FieldDescription>{copy.repeats.capHelp}</FieldDescription>
        </Field>
      </FieldGroup>
    </SettingsCard>
  )
}
