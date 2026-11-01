'use client'

import PillTabs from '@/components/layout/pill-tabs'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { keySetStatus, MODE_ORDER, type ModeKeys } from './mode-switch'

type PaymentModeControlProps = {
  /** Prefixes the label id. */
  id: string
  label: string
  /** The highlighted segment. */
  value: PaymentModeId | null
  /** The key set checkout uses now. */
  active: PaymentModeId | null
  keys: ModeKeys
  onChange: (mode: PaymentModeId) => void
  disabled?: boolean
}

/**
 * The one "Live | Test" switch for every payment gateway and courier (the cards' switch, the
 * Connect pages' key picker): the admin's segmented control. Whether each set's keys are saved
 * is read out with it; the key cards beside it show the same on screen.
 */
export default function PaymentModeControl({
  id,
  label,
  value,
  active,
  keys,
  onChange,
  disabled = false,
}: PaymentModeControlProps) {
  // Hooks
  const { mode: copy } = useCopy(paymentModesContent)

  // Event handlers
  const handleChange = (next: PaymentModeId | null) => {
    if (next) onChange(next)
  }

  // Render logic
  const tabs = MODE_ORDER.map((mode) => ({
    value: mode as PaymentModeId | null,
    label: (
      <>
        {copy[mode]}
        <span className="sr-only"> · {copy.status[keySetStatus(mode, active, keys)]}</span>
      </>
    ),
  }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id={`${id}-mode-label`} className="text-body font-medium text-foreground">
        {label}
      </span>
      <fieldset
        aria-labelledby={`${id}-mode-label`}
        disabled={disabled}
        className="m-0 min-w-0 border-0 p-0 disabled:opacity-60"
      >
        <PillTabs variant="segmented" tabs={tabs} value={value} onChange={handleChange} />
      </fieldset>
    </div>
  )
}
