import { cn } from '@commerce/ui/lib/utils'

type CountBadgeProps = {
  /** The count, or a short phrase with it ("3 items"). */
  n: number | string
  /**
   * `muted`: grey pill beside a card title. `outline`: hairline chip ("3 items", Figma Cart).
   * `inverse`: dark square chip on a button.
   */
  tone?: 'muted' | 'outline' | 'inverse'
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
        tone === 'outline' &&
          'rounded-md border border-border px-1.5 py-0.5 text-caption text-muted-foreground',
        tone === 'inverse' &&
          'flex h-4 min-w-4 items-center justify-center rounded-sm bg-foreground px-1 text-[0.6875rem] font-semibold text-background',
        className,
      )}
    >
      {n}
    </span>
  )
}
