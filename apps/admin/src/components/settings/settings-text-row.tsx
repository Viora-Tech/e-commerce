import { Input } from '@commerce/ui/shadcn/input'
import SettingsRow from './settings-row'

type SettingsTextRowProps = {
  id: string
  label: string
  description?: string | undefined
  value: string
  onChange: (v: string) => void
  error?: string | undefined
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel'
}

/** A settings row whose control is one text box. */
export default function SettingsTextRow({
  id,
  label,
  description,
  value,
  onChange,
  error,
  type,
  autoComplete,
  inputMode,
}: SettingsTextRowProps) {
  return (
    <SettingsRow label={label} description={description} htmlFor={id} error={error}>
      <Input
        size="lg"
        id={id}
        type={type ?? 'text'}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete ?? 'off'}
      />
    </SettingsRow>
  )
}
