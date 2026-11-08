'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'

/** What the card edits: the merchant's choice and the window (`store.payments`). */
type ManualCancelValue = {
  /** Unset: never chosen, so on (the default). */
  manualAutoCancel?: 'on' | 'off' | undefined
  /** Hours after the order is placed; 0 is "not set" (the default window). */
  manualCancelAfterHours: number
}

type ManualTransferFieldsProps = {
  value: ManualCancelValue
  onChange: (next: Required<ManualCancelValue>) => void
}

/** Same window as core `MANUAL_CANCEL_HOURS`: 6 hours by default, 1 to 72. */
const DEFAULT_HOURS = 6
const MIN_HOURS = 1
const MAX_HOURS = 72

const clamp = (n: number): number => Math.min(MAX_HOURS, Math.max(MIN_HOURS, n))

const toHours = (raw: string): number => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? clamp(n) : MIN_HOURS
}

/**
 * Settings › Payments: auto-cancel for UPI / bank transfer orders never paid. Off by default;
 * reads the stored value the way core `manualCancelHoursOf` does.
 */
export default function ManualTransferFields({ value, onChange }: ManualTransferFieldsProps) {
  // Hooks
  const copy = useCopy(paymentsSettingsContent)

  // Render logic
  const on =
    value.manualAutoCancel === 'on' ||
    (value.manualAutoCancel !== 'off' && value.manualCancelAfterHours > 0)
  const hours = clamp(
    value.manualCancelAfterHours > 0 ? value.manualCancelAfterHours : DEFAULT_HOURS,
  )

  return (
    <SettingsCard title={copy.transfers.heading}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Switch
            id="transfer-auto-cancel"
            checked={on}
            onCheckedChange={(next) =>
              onChange({ manualAutoCancel: next ? 'on' : 'off', manualCancelAfterHours: hours })
            }
          />
          <FieldLabel htmlFor="transfer-auto-cancel">{copy.transfers.autoCancel}</FieldLabel>
        </Field>
        <FieldDescription>{copy.transfers.autoCancelHelp}</FieldDescription>
        {on ? (
          <Field>
            <FieldLabel htmlFor="transfer-cancel">{copy.transfers.cancelLabel}</FieldLabel>
            <Input
              size="lg"
              id="transfer-cancel"
              type="number"
              min={MIN_HOURS}
              max={MAX_HOURS}
              value={String(hours)}
              onChange={(e) =>
                onChange({
                  manualAutoCancel: 'on',
                  manualCancelAfterHours: toHours(e.target.value),
                })
              }
              autoComplete="off"
            />
            <FieldDescription>{copy.transfers.cancelHelp}</FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
    </SettingsCard>
  )
}
