'use client'

import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import Icon from '../icon'

type StarPickerProps = {
  value: number
  onChange: (value: number) => void
}

const STEPS = [1, 2, 3, 4, 5]

/** Five large tappable stars (radio buttons underneath), with the choice spelled out below. */
export default function StarPicker({ value, onChange }: StarPickerProps) {
  // Render logic
  const name = copy.form.ratingNames[value] ?? ''

  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-2 text-sm font-medium text-ink">{copy.form.rating}</legend>
      <div className="flex items-center gap-1">
        {STEPS.map((n) => (
          <label
            key={n}
            className={`flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-md transition-[color,scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
              n <= value ? 'text-brand' : 'text-line'
            }`}
          >
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={copy.form.star(n)}
            />
            <Icon name="star" size={28} />
          </label>
        ))}
      </div>
      <p className="m-0 text-sm text-muted" aria-live="polite">
        {value > 0 ? copy.form.ratingValue(value, name) : copy.form.ratingHint}
      </p>
    </fieldset>
  )
}
