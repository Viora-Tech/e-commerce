'use client'

import { quantityContent as copy } from '../data/quantity'
import Icon from './icon'

type QuantityInputProps = {
  value: number
  onChange: (value: number) => void
  min?: number | undefined
  /** The most that can be added (stock); none means no cap. */
  max?: number | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

/** Figma Store / Quantity (691:85126): minus, the number and plus inside one bordered field. */
export default function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  className,
}: QuantityInputProps) {
  // Helpers
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n))

  // Render logic
  return (
    <div className={className ? `quantity-input ${className}` : 'quantity-input'}>
      <button
        type="button"
        className="quantity-input__button"
        aria-label={copy.decrease}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Icon name="minus" size={16} />
      </button>
      <input
        className="quantity-input__field"
        type="number"
        inputMode="numeric"
        aria-label={copy.label}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(clamp(n))
        }}
      />
      <button
        type="button"
        className="quantity-input__button"
        aria-label={copy.increase}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
