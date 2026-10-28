'use client'

import { type FieldValidations, ratingMaxOf } from '@commerce/core/metaobjects'
import { StarHalfIcon, StarIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type RatingInputProps = {
  id: string
  value: unknown
  rules?: FieldValidations | undefined
  onChange: (value: unknown) => void
}

/** The saved number of stars, from `{ value, max }` or a bare number. */
function starsOf(value: unknown): number | null {
  const v =
    typeof value === 'object' && value !== null ? (value as { value?: unknown }).value : value
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Stars to tap: tapping the third star gives 3 stars. Half stars (from an import) show as
 * half filled. "Clear" takes the rating away.
 */
export default function RatingInput({ id, value, rules, onChange }: RatingInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)

  // Render logic
  const max = ratingMaxOf(rules)
  const stars = starsOf(value)
  const steps = Array.from({ length: max }, (_, i) => i + 1)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <fieldset id={id} className="m-0 flex min-w-0 items-center border-0 p-0">
        {steps.map((n) => {
          const full = stars !== null && stars >= n
          const half = stars !== null && !full && stars >= n - 0.5
          return (
            <button
              key={n}
              type="button"
              aria-pressed={stars === n}
              aria-label={copy.rating.star(n)}
              onClick={() => onChange({ value: n, max })}
              className={cn(
                'flex size-9 touch-manipulation items-center justify-center rounded-md transition-[color,scale] duration-(--duration-press) ease-out hover:text-warning focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-(--motion-press-scale) [&_svg]:size-6',
                full || half ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {half ? <StarHalfIcon /> : <StarIcon fill={full ? 'currentColor' : 'none'} />}
            </button>
          )
        })}
      </fieldset>
      <span className="text-body text-muted-foreground">
        {stars === null ? copy.rating.none : copy.rating.value(stars, max)}
      </span>
      {stars !== null ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          {copy.rating.clear}
        </Button>
      ) : null}
    </div>
  )
}
