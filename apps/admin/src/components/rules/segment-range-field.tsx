'use client'

import { Input } from '@commerce/ui/shadcn/input'
import MoneyInput from '@/components/fields/money-input'
import { segmentsContent as copy } from '@/data/customers'

type SegmentRangeFieldProps = {
  /** "min,max"; money fields hold paise. */
  value: string
  /** Rupees in the boxes, paise in the rule (spend, average order value). */
  money: boolean
  label: string
  onChange: (value: string) => void
}

function paiseToRupees(paise: string): string {
  const n = Number.parseInt(paise, 10)
  return Number.isFinite(n) && n !== 0 ? String(n / 100) : ''
}

function rupeesToPaise(rupees: string): string {
  const n = Number.parseFloat(rupees)
  return Number.isFinite(n) ? String(Math.round(n * 100)) : ''
}

/** "is between": a Min and a Max box; either may stay empty for an open end (#1020). */
export default function SegmentRangeField({
  value,
  money,
  label,
  onChange,
}: SegmentRangeFieldProps) {
  // Event handlers
  const handleSide = (side: 0 | 1, next: string) => {
    const parts = value.split(',')
    const pair = [parts[0] ?? '', parts[1] ?? '']
    pair[side] = money ? rupeesToPaise(next) : next
    onChange(pair.join(','))
  }

  // Render logic
  const [lo = '', hi = ''] = value.split(',')

  return (
    <div className="flex items-center gap-2">
      {money ? (
        <>
          <div className="w-28">
            <MoneyInput
              aria-label={`${label} ${copy.min}`}
              placeholder={copy.min}
              value={paiseToRupees(lo)}
              onChange={(v) => handleSide(0, v)}
            />
          </div>
          <div className="w-28">
            <MoneyInput
              aria-label={`${label} ${copy.max}`}
              placeholder={copy.max}
              value={paiseToRupees(hi)}
              onChange={(v) => handleSide(1, v)}
            />
          </div>
        </>
      ) : (
        <>
          <Input
            className="w-24"
            inputMode="numeric"
            aria-label={`${label} ${copy.min}`}
            placeholder={copy.min}
            value={lo}
            onChange={(e) => handleSide(0, e.target.value)}
          />
          <Input
            className="w-24"
            inputMode="numeric"
            aria-label={`${label} ${copy.max}`}
            placeholder={copy.max}
            value={hi}
            onChange={(e) => handleSide(1, e.target.value)}
          />
        </>
      )}
    </div>
  )
}
