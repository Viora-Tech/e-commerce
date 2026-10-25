'use client'

import { Input } from '@commerce/ui/shadcn/input'
import SettingsRow from '@/components/settings/settings-row'

type NumberRowProps = {
  id: string
  label: string
  description?: string | undefined
  error?: string | undefined
  value: number
  min: number
  max?: number | undefined
  onChange: (n: number) => void
}

/** A whole number clamped to its range, rounded as it is typed. */
function clamp(raw: string, min: number, max: number | undefined): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return min
  return Math.max(min, max === undefined ? n : Math.min(max, n))
}

/** One settings row with a small number field (hours, a score, rupees, a percent). */
export default function NumberRow({
  id,
  label,
  description,
  error,
  value,
  min,
  max,
  onChange,
}: NumberRowProps) {
  // Render logic
  return (
    <SettingsRow label={label} description={description} htmlFor={id} error={error}>
      <Input
        size="lg"
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className="w-32"
        value={value}
        onChange={(e) => onChange(clamp(e.target.value, min, max))}
      />
    </SettingsRow>
  )
}
