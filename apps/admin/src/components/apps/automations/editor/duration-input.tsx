'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { splitMinutes, UNIT_MINUTES } from '@/lib/automation-labels'
import SelectInput from './select-input'

type Unit = keyof typeof UNIT_MINUTES

type DurationInputProps = {
  id: string
  minutes: number
  min: number
  max: number
  onChange: (minutes: number) => void
}

const UNITS: Unit[] = ['minutes', 'hours', 'days']

/** A number and a unit (minutes, hours, days), stored as minutes and kept within `min`–`max`. */
export default function DurationInput({ id, minutes, min, max, onChange }: DurationInputProps) {
  // Hooks
  const { panel: copy } = useCopy(automationEditorContent)
  const [unit, setUnit] = useState<Unit>(() => splitMinutes(minutes).unit)

  // Helpers
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))

  // Event handlers
  const handleValue = (raw: string) => {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) onChange(clamp(n * UNIT_MINUTES[unit]))
  }

  const handleUnit = (next: Unit) => {
    setUnit(next)
    onChange(clamp(Math.max(1, Math.round(minutes / UNIT_MINUTES[unit])) * UNIT_MINUTES[next]))
  }

  // Render logic
  const value = Math.max(1, Math.round(minutes / UNIT_MINUTES[unit]))

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        className="w-28"
        onChange={(e) => handleValue(e.target.value)}
      />
      <SelectInput
        value={unit}
        aria-label={copy.wait}
        className="flex-1"
        options={UNITS.map((u) => ({ value: u, label: copy.units[u] }))}
        onChange={(v) => handleUnit(v as Unit)}
      />
    </div>
  )
}
