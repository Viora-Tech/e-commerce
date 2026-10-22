'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'

type OtpInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  invalid?: boolean
  disabled?: boolean
  /** Called once the last digit lands (typed, pasted or autofilled), so the form can submit itself. */
  onComplete?: (value: string) => void
}

const LENGTH = 6
const GROUP = 3
const SLOTS = ['one', 'two', 'three', 'four', 'five', 'six']

/**
 * Six code slots (3, a dash, 3) over ONE real input, so typing, paste, backspace, screen readers
 * and the browser's one-time-code autofill all behave like a normal field. Pattern: shadcn
 * InputOTP (MIT), built without the `input-otp` package.
 */
export default function OtpInput({
  id,
  value,
  onChange,
  label,
  invalid,
  disabled,
  onComplete,
}: OtpInputProps) {
  // Hooks
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => inputRef.current?.focus(), [])

  // Event handlers
  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, LENGTH)
    onChange(next)
    if (next.length === LENGTH && value.length < LENGTH) onComplete?.(next)
  }

  // Render logic
  const active = Math.min(value.length, LENGTH - 1)

  return (
    <div className="relative w-fit">
      <div className="flex items-center gap-2" aria-hidden>
        {SLOTS.map((slot, i) => (
          <div key={slot} className="flex items-center gap-2">
            {i === GROUP ? <span className="h-0.5 w-2 rounded-full bg-border" /> : null}
            <div
              className={cn(
                'flex size-12 items-center justify-center rounded-md border border-input bg-card text-stat-sm text-ink-strong shadow-lift transition-[border-color,box-shadow] duration-150',
                focused && i === active && 'border-primary ring-3 ring-primary/20',
                invalid && 'border-destructive',
              )}
            >
              {value[i] ?? ''}
            </div>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        id={id}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={LENGTH}
        disabled={disabled}
        className="absolute inset-0 size-full cursor-text opacity-0"
      />
    </div>
  )
}
