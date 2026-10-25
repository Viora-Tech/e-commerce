'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'

type ManualTransferFieldsProps = {
  /** Hours after the order is placed; 0 means auto-cancel is off. */
  cancelHours: number
  onChange: (hours: number) => void
}

/** The window suggested when the merchant turns auto-cancel on. */
const DEFAULT_HOURS = 48
/** The largest window the setting accepts: 30 days. */
const MAX_HOURS = 720

const toHours = (raw: string): number => {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_HOURS)
}

/** Settings › Payments: opt-in auto-cancel for UPI / bank transfer orders never paid. */
export default function ManualTransferFields({ cancelHours, onChange }: ManualTransferFieldsProps) {
  // Hooks
  const copy = useCopy(paymentsSettingsContent)

  // Render logic
  const on = cancelHours > 0

  return (
    <SettingsCard title={copy.transfers.heading}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Switch
            id="transfer-auto-cancel"
            checked={on}
            onCheckedChange={(next) => onChange(next ? DEFAULT_HOURS : 0)}
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
              min={1}
              max={MAX_HOURS}
              value={String(cancelHours)}
              onChange={(e) => onChange(toHours(e.target.value))}
              autoComplete="off"
            />
            <FieldDescription>{copy.transfers.cancelHelp}</FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
    </SettingsCard>
  )
}
