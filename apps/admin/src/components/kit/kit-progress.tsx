import { cn } from '@commerce/ui/lib/utils'

type KitProgressProps = { value: number; className?: string }

/** Sheet 14:508 "line": 6px track, radius 10; neutral track with Ocean Green fill (indigo dropped). */
export default function KitProgress({ value, className }: KitProgressProps) {
  // Render logic
  const width = `${Math.min(100, Math.max(0, Math.round(value * 100)))}%`

  return (
    <span
      className={cn(
        'block h-1.5 w-full overflow-hidden rounded-[0.625rem] bg-muted',
        className,
      )}
    >
      <span className="block h-full rounded-[0.625rem] bg-primary" style={{ width }} />
    </span>
  )
}
