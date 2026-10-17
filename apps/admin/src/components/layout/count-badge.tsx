import { cn } from '@commerce/ui/lib/utils'

type CountBadgeProps = {
  n: number
  /** `muted`: grey pill beside a card title. `inverse`: dark square chip on a button. */
  tone?: 'muted' | 'inverse'
  className?: string
}

/** The small number beside a title or on a button: how many rows, how many filters. */
export default function CountBadge({ n, tone = 'muted', className }: CountBadgeProps) {
  return (
    <span
      className={cn(
        'tabular-nums',
        tone === 'muted' &&
          'rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground',
        tone === 'inverse' &&
          'flex h-4 min-w-4 items-center justify-center rounded-sm bg-foreground px-1 text-[0.6875rem] font-semibold text-background',
        className,
      )}
    >
      {n}
    </span>
  )
}
