'use client'

import PhoneInput from '@commerce/ui/phone-input'
import SettingsRow from './settings-row'

type SettingsPhoneRowProps = {
  id: string
  label: string
  description?: string | undefined
  value: string
  onChange: (v: string) => void
  error?: string | undefined
}

/** A settings row whose control is the phone input (flag + calling code picker). */
export default function SettingsPhoneRow({
  id,
  label,
  description,
  value,
  onChange,
  error,
}: SettingsPhoneRowProps) {
  return (
    <SettingsRow label={label} description={description} htmlFor={id} error={error}>
      <PhoneInput
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        autoComplete="tel"
      />
    </SettingsRow>
  )
}
