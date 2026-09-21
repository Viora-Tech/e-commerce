'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { BlockStack, FormLayout, Select, Text, TextField } from '@shopify/polaris'
import { useState } from 'react'
import { paymentsSettingsContent } from '@/data/payments'

type PaymentAdjustmentFieldsProps = {
  value: PaymentAdjustment | undefined
  onChange: (next: PaymentAdjustment | undefined) => void
}

type AdjustmentType = PaymentAdjustment['type']

const copy = paymentsSettingsContent.adjustment

/** Rupees and percent both store ×100 (paise / basis points). */
const toStored = (text: string): number | null => {
  const n = Number(text)
  return text.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100)
}
const toText = (stored: number | undefined): string =>
  stored === undefined ? '' : String(stored / 100)

export function PaymentAdjustmentFields({ value, onChange }: PaymentAdjustmentFieldsProps) {
  const [amountText, setAmountText] = useState(toText(value?.value))

  const type: AdjustmentType | 'none' = value?.type ?? 'none'

  const handleType = (next: string) => {
    if (next === 'none') {
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

  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingXs">
        {copy.heading}
      </Text>
      <FormLayout>
        <FormLayout.Group condensed>
          <Select
            label={copy.typeLabel}
            options={[...copy.types]}
            value={type}
            onChange={handleType}
          />
          {type !== 'none' ? (
            <TextField
              label={copy.amountLabel[type]}
              type="number"
              step={type === 'percent' ? 0.5 : 1}
              value={amountText}
              onChange={handleAmount}
              helpText={copy.amountHelp}
              autoComplete="off"
            />
          ) : null}
        </FormLayout.Group>
        {type !== 'none' ? (
          <TextField
            label={copy.labelLabel}
            value={value?.label ?? ''}
            placeholder={copy.labelPlaceholder[type]}
            onChange={handleLabel}
            autoComplete="off"
          />
        ) : null}
      </FormLayout>
    </BlockStack>
  )
}
