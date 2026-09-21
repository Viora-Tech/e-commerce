'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { paymentsSettingsContent } from '@/data/payments'

type PaymentAdjustmentFieldsProps = {
  providerId: string
  value: PaymentAdjustment | undefined
  onChange: (next: PaymentAdjustment | undefined) => void
}

type AdjustmentType = PaymentAdjustment['type']

const copy = paymentsSettingsContent.adjustment
const typeItems = Object.fromEntries(copy.types.map((t) => [t.value, t.label]))

/** Rupees and percent both store ×100 (paise / basis points). */
const toStored = (text: string): number | null => {
  const n = Number(text)
  return text.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100)
}
const toText = (stored: number | undefined): string =>
  stored === undefined ? '' : String(stored / 100)

export default function PaymentAdjustmentFields({
  providerId,
  value,
  onChange,
}: PaymentAdjustmentFieldsProps) {
  // Hooks
  const [amountText, setAmountText] = useState(toText(value?.value))

  // Event handlers
  const handleType = (next: string | null) => {
    if (!next || next === 'none') {
      setAmountText('')
      onChange(undefined)
      return
    }
    const t = next as AdjustmentType
    onChange({ type: t, value: toStored(amountText) ?? 0, label: value?.label })
  }

  const handleAmount = (text: string) => {
    setAmountText(text)
    if (type === 'none') return
    const stored = toStored(text)
    if (stored !== null) onChange({ type, value: stored, label: value?.label })
  }

  const handleLabel = (label: string) => {
    if (type === 'none') return
    onChange({ type, value: value?.value ?? 0, label: label || undefined })
  }

  // Render logic
  const type: AdjustmentType | 'none' = value?.type ?? 'none'
  const ids = {
    type: `adj-${providerId}-type`,
    amount: `adj-${providerId}-amount`,
    label: `adj-${providerId}-label`,
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body font-bold text-ink-strong">{copy.heading}</h3>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={ids.type}>{copy.typeLabel}</FieldLabel>
            <Select items={typeItems} value={type} onValueChange={handleType}>
              <SelectTrigger size="lg" id={ids.type} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {copy.types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {type !== 'none' ? (
            <Field>
              <FieldLabel htmlFor={ids.amount}>{copy.amountLabel[type]}</FieldLabel>
              <Input
                size="lg"
                id={ids.amount}
                type="number"
                step={type === 'percent' ? 0.5 : 1}
                value={amountText}
                onChange={(e) => handleAmount(e.target.value)}
                autoComplete="off"
              />
              <FieldDescription>{copy.amountHelp}</FieldDescription>
            </Field>
          ) : null}
        </div>
        {type !== 'none' ? (
          <Field>
            <FieldLabel htmlFor={ids.label}>{copy.labelLabel}</FieldLabel>
            <Input
              size="lg"
              id={ids.label}
              value={value?.label ?? ''}
              placeholder={copy.labelPlaceholder[type]}
              onChange={(e) => handleLabel(e.target.value)}
              autoComplete="off"
            />
          </Field>
        ) : null}
      </FieldGroup>
    </div>
  )
}
