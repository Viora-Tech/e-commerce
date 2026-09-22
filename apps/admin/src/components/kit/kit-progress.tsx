import { cn } from '@commerce/ui/lib/utils'

type KitProgressProps = { value: number; className?: string }

/** Sheet 14:508 "line": 6px track in Primary/50, radius 10, Primary/500 fill. */
export default function KitProgress({ value, className }: KitProgressProps) {
  // Render logic
  const width = `${Math.min(100, Math.max(0, Math.round(value * 100)))}%`

  return (
    <span
      className={cn(
        'block h-1.5 w-full overflow-hidden rounded-[0.625rem] bg-link-soft',
        className,
      )}
    >
      <span className="block h-full rounded-[0.625rem] bg-link" style={{ width }} />
    </span>
  )
}
