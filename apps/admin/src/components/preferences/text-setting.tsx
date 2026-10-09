'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import SettingsRow from '@/components/settings/settings-row'

type TextSettingProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  help?: string | undefined
  error?: string | undefined
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  type?: 'text' | 'password'
}

/** One text preference as a settings row: label and help left, the field right, any error under it. */
export default function TextSetting({
  id,
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
  maxLength,
  multiline,
  type = 'text',
}: TextSettingProps) {
  // Render logic
  const shared = {
    id,
    value,
    placeholder,
    maxLength,
    'aria-invalid': error ? true : undefined,
    autoComplete: 'off',
  }

  return (
    <SettingsRow label={label} htmlFor={id} description={error ? undefined : help} error={error}>
      {multiline ? (
        <Textarea {...shared} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...shared} size="lg" type={type} onChange={(e) => onChange(e.target.value)} />
      )}
    </SettingsRow>
  )
}
