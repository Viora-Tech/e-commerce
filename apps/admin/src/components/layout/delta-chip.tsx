import { cn } from '@commerce/ui/lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { layoutContent } from '@/data/layout'

/** Percent change between two window values; null when there is nothing to compare against. */
export function percentDelta(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / previous) * 100
}

/** 5:1508: 16px arrow glyph and a 14px figure, green up / red down. */
export default function DeltaChip({
  delta,
  invert,
}: {
  delta: number | null | undefined
  invert?: boolean
}) {
  if (delta === null || delta === undefined) return null
  const flat = Math.abs(delta) < 0.05
  const up = delta > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center text-period tabular-nums',
        flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
      )}
    >
      {flat ? null : <Icon className="size-4" />}
      {flat ? layoutContent.noChange : `${Math.abs(delta).toFixed(1)}%`}
    </span>
  )
}
