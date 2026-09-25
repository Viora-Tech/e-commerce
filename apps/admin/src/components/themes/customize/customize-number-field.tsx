'use client'

import { FieldNumber } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import FieldFrame from './field-frame'

type CustomizeNumberFieldProps = {
  field: { label?: string; placeholder?: string; min?: number; max?: number; step?: number }
  value: number | undefined
  onChange: (value: number) => void
  id?: string
  readOnly?: boolean
  name: string
}

/** Puck's `number` field: a slider alongside the input when the field has both a min and a max. */
export default function CustomizeNumberField({
  field,
  value,
  onChange,
  id,
  readOnly,
  name,
}: CustomizeNumberFieldProps) {
  // Event handlers
  const handleChange = (raw: string) => {
    const next = Number(raw)
    if (!Number.isNaN(next)) onChange(next)
  }

  // Render logic
  const label = field.label ?? name
  const hasRange = field.min !== undefined && field.max !== undefined
  const current = value ?? field.min ?? 0

  return (
    <FieldFrame icon={FieldNumber} label={label}>
      <div className="flex items-center gap-3">
        {hasRange ? (
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={current}
            disabled={readOnly}
            onChange={(e) => handleChange(e.target.value)}
            className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        ) : null}
        <Input
          id={id}
          type="number"
          value={value ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => handleChange(e.target.value)}
          size="lg"
          className={hasRange ? 'w-20 shrink-0 rounded-xl text-center' : 'rounded-xl'}
        />
      </div>
    </FieldFrame>
  )
}
