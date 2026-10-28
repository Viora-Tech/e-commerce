import { StarIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type ReviewStarsProps = {
  /** Out of 5; halves draw a half star. */
  value: number
  /** Read out to screen readers, e.g. "4 out of 5 stars". */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

const STEPS = [1, 2, 3, 4, 5]
const SIZE = { sm: '[&_svg]:size-3.5', md: '[&_svg]:size-4.5' } as const

/**
 * A row of five filled stars in the warning (amber) tone; empty ones in muted ink. The icon set
 * only has outline glyphs (`weight` just thickens the line), so stars are filled with
 * `fill="currentColor"`, and a half star is the amber star clipped to its left half.
 */
export default function ReviewStars({ value, label, size = 'sm', className }: ReviewStarsProps) {
  // Render logic
  const rounded = Math.round(value * 2) / 2

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center', SIZE[size], className)}
    >
      {STEPS.map((n) => {
        const full = rounded >= n
        const half = !full && rounded >= n - 0.5
        return (
          <span
            key={n}
            className={cn(
              'relative inline-flex',
              full ? 'text-warning' : 'text-muted-foreground/40',
            )}
          >
            <StarIcon fill="currentColor" aria-hidden />
            {half ? (
              <span className="absolute inset-y-0 left-0 flex w-1/2 overflow-hidden text-warning">
                <StarIcon fill="currentColor" aria-hidden />
              </span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
