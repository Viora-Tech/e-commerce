'use client'

import { Minus, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { quantityInputContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type QuantityInputProps = {
  id?: string | undefined
  /** As typed, so an empty box stays empty while the merchant types. */
  value: string
  onChange: (value: string) => void
  min?: number
  invalid?: boolean | undefined
  'aria-label'?: string | undefined
}

/** A whole-number box with − and + beside it (Buy X get Y quantities, audit #181). */
export default function QuantityInput({
  id,
  value,
  onChange,
  min = 1,
  invalid,
  'aria-label': ariaLabel,
}: QuantityInputProps) {
  // Hooks
  const copy = useCopy(quantityInputContent)

  // Helpers
  const step = (by: number) => {
    const n = Number.parseInt(value, 10)
    onChange(String(Math.max(min, (Number.isFinite(n) ? n : min - by) + by)))
  }

  // Render logic
  const n = Number.parseInt(value, 10)

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={copy.less}
        disabled={Number.isFinite(n) && n <= min}
        onClick={() => step(-1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Input
        size="lg"
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-center tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={copy.more}
        onClick={() => step(1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )
}
