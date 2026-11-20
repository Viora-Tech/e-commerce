'use client'

import type { OptionCodFee } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'

type CodFeeFieldProps = {
  id: string
  value: OptionCodFee
  onChange: (next: OptionCodFee) => void
}

/**
 * "Cash on delivery fee: included in the delivery price / shown as a separate charge" for one
 * option (owner, 20 Nov 2026), like the insurance setting. Saves `cod.fee`.
 */
export default function CodFeeField({ id, value, onChange }: CodFeeFieldProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  const t = pages.codFee

  return (
    <ChoiceField
      id={id}
      label={t.label}
      help={t.help}
      value={value}
      options={[
        { value: 'included', label: t.included },
        { value: 'separate', label: t.separate },
      ]}
      onChange={(v) => onChange(v === 'separate' ? 'separate' : 'included')}
    />
  )
}
