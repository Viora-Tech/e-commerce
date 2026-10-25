import { Input } from '@commerce/ui/shadcn/input'
import SettingsRow from '@/components/settings/settings-row'

type NumberFieldProps = {
  id: string
  label: string
  description?: string | undefined
  /** The stored integer (basis points, paise, days). */
  value: number
  /** Stored units per typed unit: 100 for percent (bp) and rupees (paise), 1 for days. */
  scale?: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

/** A settings row with a number box, converting typed percent or rupees to stored units. */
export default function NumberField({
  id,
  label,
  description,
  value,
  scale = 1,
  min = 0,
  max,
  onChange,
}: NumberFieldProps) {
  // Render logic
  return (
    <SettingsRow label={label} description={description} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={scale === 1 ? 1 : 0.01}
        className="max-w-40"
        value={value / scale}
        onChange={(e) => onChange(Math.max(min, Math.round((Number(e.target.value) || 0) * scale)))}
      />
    </SettingsRow>
  )
}
