'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { paymentsSettingsContent as copy } from '@/data/payments'

type UnpaidExpiryFieldProps = {
  /** Minutes; 0 means never. */
  value: number
  onChange: (minutes: number) => void
}

/** The largest window the setting accepts: one week. */
const MAX_MINUTES = 10_080

const toMinutes = (raw: string): number => {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, MAX_MINUTES)
}

/** Settings › Payments: how long an online order may stay unpaid before it is cancelled. */
export default function UnpaidExpiryField({ value, onChange }: UnpaidExpiryFieldProps) {
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.unpaid.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="unpaid-expiry">{copy.unpaid.label}</FieldLabel>
            <Input
              size="lg"
              id="unpaid-expiry"
              type="number"
              min={0}
              max={MAX_MINUTES}
              value={String(value)}
              onChange={(e) => onChange(toMinutes(e.target.value))}
              autoComplete="off"
            />
            <FieldDescription>{copy.unpaid.help}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
