'use client'

import { parseRupees } from '@commerce/money'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'

type DraftMoneyInputProps = {
  id?: string
  'aria-label'?: string
  valuePaise: number
  onChangePaise: (paise: number) => void
  className?: string
}

/**
 * Rupee field that keeps what the merchant is typing while it has focus, so the
 * box can be emptied and retyped; the amount reads 0 meanwhile and the text is
 * tidied to two decimals on blur.
 */
export default function DraftMoneyInput({
  id,
  'aria-label': ariaLabel,
  valuePaise,
  onChangePaise,
  className,
}: DraftMoneyInputProps) {
  // Hooks
  const [text, setText] = useState<string | null>(null)

  // Event handlers
  const handleChange = (next: string) => {
    setText(next)
    onChangePaise(parseRupees(next) ?? 0)
  }

  // Render logic
  const shown = text ?? (valuePaise / 100).toFixed(2)

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      type="number"
      min={0}
      step="0.01"
      value={shown}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setText(null)}
      className={className}
    />
  )
}
