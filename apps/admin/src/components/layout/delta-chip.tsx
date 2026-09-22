import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { layoutContent } from '@/data/layout'

/** Percent change between two window values; null when there is nothing to compare against. */
export function percentDelta(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / previous) * 100
}

/** Sheet 14:359: 16px arrow glyph and a 14/500 figure, Success/500 up, Error/500 down. */
type DeltaChipProps = {
  delta: number | null | undefined
  invert?: boolean
  /** `kit` = sheet 14:357 (14/500 figure, 16px arrow) for the dashboard tiles. */
  size?: 'default' | 'kit'
  className?: string
}

export default function DeltaChip({ delta, invert, size = 'default', className }: DeltaChipProps) {
  if (delta === null || delta === undefined) return null
  const flat = Math.abs(delta) < 0.05
  const up = delta > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center tabular-nums',
        size === 'kit' ? 'text-kit-body font-medium' : 'text-period',
        flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
        className,
      )}
    >
      {flat ? null : <Icon className="size-4" />}
      {flat ? layoutContent.noChange : `${Math.abs(delta).toFixed(1)}%`}
    </span>
  )
}
