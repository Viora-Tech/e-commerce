'use client'

import { useId } from 'react'

type RangeFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** How the current value reads next to the label, e.g. "8px". */
  format: (value: number) => string
  onChange: (value: number) => void
}

/** Labelled slider with its value shown on the right, like Shopify's range settings. */
export default function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: RangeFieldProps) {
  // Hooks
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-body text-foreground">
          {label}
        </label>
        <span className="text-body text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-primary"
      />
    </div>
  )
}
