'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { toRupees } from './format'

type InsuranceOfferFieldsProps = {
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
  /** Prefix for the fields' ids: one set per option on the page. */
  idPrefix: string
}

/**
 * "Offer parcel insurance at checkout" and "Only for orders above ₹X" for one option, on the
 * Options page (owner, 20 Nov): on, shoppers see insurance ticked and may untick it to leave it
 * out; off, it is not offered. Saves `insurance.default` and `insurance.onlyAbovePaise`.
 */
export default function InsuranceOfferFields({
  option,
  onChange,
  idPrefix,
}: InsuranceOfferFieldsProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  /** Typed text, so "12." survives; the option keeps paise. */
  const [above, setAbove] = useState(toRupees(option.insurance.onlyAbovePaise))

  // Event handlers
  const handleOffer = (on: boolean) =>
    onChange({ ...option, insurance: { ...option.insurance, default: on ? 'on' : 'off' } })
  const handleAbove = (text: string) => {
    setAbove(text)
    onChange({
      ...option,
      insurance: { ...option.insurance, onlyAbovePaise: parseRupees(text) ?? null },
    })
  }

  // Render logic
  const t = pages.insurance
  const on = option.insurance.default === 'on'

  return (
    <div className="flex flex-col gap-3">
      <SettingsToggleRow
        id={`${idPrefix}-insurance`}
        label={t.offer}
        description={t.offerHelp}
        checked={on}
        onChange={handleOffer}
      />
      {on ? (
        <Field className="max-w-60">
          <FieldLabel htmlFor={`${idPrefix}-insurance-above`}>{t.onlyAbove}</FieldLabel>
          <MoneyInput id={`${idPrefix}-insurance-above`} value={above} onChange={handleAbove} />
          <FieldDescription>{t.onlyAboveHelp}</FieldDescription>
        </Field>
      ) : null}
    </div>
  )
}
