'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { preferencesContent as copy } from '@/data/preferences'

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

/** Figma Preferences (685:78485): label over the field, help on the left, a character count on
 *  the right when the field has a limit, any error in place of the help. */
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-body-strong text-foreground">
        {label}
      </label>
      {multiline ? (
        <Textarea {...shared} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...shared} size="lg" type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      <div className="flex items-start justify-between gap-3 text-caption">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <p className="text-muted-foreground">{help}</p>
        )}
        {maxLength && type !== 'password' ? (
          <p className="shrink-0 text-muted-foreground tabular-nums">
            {copy.seo.count(value.length, maxLength)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
