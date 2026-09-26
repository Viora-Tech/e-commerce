'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
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
    <FieldFrame label={label} htmlFor={id}>
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
            className="h-1 w-full min-w-0 flex-1 cursor-pointer accent-primary"
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
          className={cn(FIELD_CONTROL, hasRange && 'w-16 shrink-0 px-1.5 text-center tabular-nums')}
        />
      </div>
    </FieldFrame>
  )
}
