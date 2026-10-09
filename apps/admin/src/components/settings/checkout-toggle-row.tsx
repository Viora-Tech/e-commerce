'use client'

import SettingsToggleRow from './settings-toggle-row'

type CheckoutToggleRowProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (on: boolean) => void
}

/** A yes/no checkout setting: label and hint on the left, switch on the right. */
export default function CheckoutToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: CheckoutToggleRowProps) {
  return (
    <SettingsToggleRow
      id={id}
      label={label}
      description={hint}
      checked={checked}
      onChange={onChange}
    />
  )
}
