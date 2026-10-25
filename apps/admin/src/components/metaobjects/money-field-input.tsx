'use client'

import { currencyOf, type FieldValidations } from '@commerce/core/metaobjects'
import { fromMinor, parseRupees } from '@commerce/money'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type MoneyFieldInputProps = {
  id: string
  value: unknown
  rules?: FieldValidations | undefined
  invalid?: boolean | undefined
  onChange: (value: unknown) => void
}

/** The saved amount in paise / cents, if the value has one. */
function amountOf(value: unknown): number | null {
  const amount =
    typeof value === 'object' && value !== null ? (value as { amount?: unknown }).amount : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

/**
 * A money field: the merchant types rupees (₹499 or 12.50), the field saves whole paise with
 * its currency. What is being typed stays as typed until the box loses focus.
 */
export default function MoneyFieldInput({
  id,
  value,
  rules,
  invalid,
  onChange,
}: MoneyFieldInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const [draft, setDraft] = useState<string | null>(null)

  // Event handlers
  const handleChange = (text: string) => {
    setDraft(text)
    if (text.trim() === '') {
      onChange(null)
      return
    }
    const paise = parseRupees(text)
    // Junk stays in the value so the save shows "needs an amount" instead of dropping it.
    onChange({ amount: paise ?? text, currency })
  }

  // Render logic
  const currency = currencyOf(rules)
  const amount = amountOf(value)
  // The typed text while it still means the saved amount (so "12." survives); else the amount.
  const typed = draft === null ? undefined : draft.trim() === '' ? null : parseRupees(draft)
  const shown =
    draft !== null && typed === amount
      ? draft
      : amount === null
        ? ''
        : String(fromMinor(amount, currency))

  return (
    <div className="w-full sm:max-w-60">
      <MoneyInput
        id={id}
        size="lg"
        value={shown}
        currency={currency === 'INR'}
        suffix={currency === 'INR' ? undefined : currency}
        invalid={invalid}
        aria-label={copy.amount}
        placeholder="0"
        onChange={handleChange}
      />
    </div>
  )
}
