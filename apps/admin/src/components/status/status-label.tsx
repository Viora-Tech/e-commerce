import { cn } from '@commerce/ui/lib/utils'
import { type StatusKind, type StatusTone, type StatusValue, statusEntry } from '@/data/status'

type StatusLabelProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** `dot`: 8px dot + label (payment cell 5:2620). `glyph`: 24px glyph + coloured label (status cell 5:2624). `pill`: soft tinted badge. */
  variant?: 'dot' | 'glyph' | 'pill'
  size?: 'sm' | 'md'
  /** Overrides the mapped label (e.g. raw gateway text). */
  label?: string | undefined
  className?: string
}

const TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  pending: 'text-warning-foreground dark:text-warning',
  error: 'text-destructive',
  info: 'text-ink-strong',
  neutral: 'text-muted-foreground',
}

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  pending: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-ink-strong',
  neutral: 'bg-muted-foreground-soft',
}

const PILL: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success',
  pending: 'bg-warning/15 text-warning-foreground dark:text-warning',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-primary-soft text-ink-strong',
  neutral: 'bg-muted text-muted-foreground',
}

const SIZE = { sm: 'text-body', md: 'text-kit-cell' } as const

/** The one status renderer: every order, payment, shipment, product, discount, page and app state goes through here. */
export default function StatusLabel<K extends StatusKind>({
  kind,
  value,
  variant = 'dot',
  size = 'md',
  label,
  className,
}: StatusLabelProps<K>) {
  // Render logic
  const entry = statusEntry(kind, value)
  const text = label ?? entry.label
  const Glyph = variant === 'glyph' ? entry.glyph : undefined

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-md px-2 font-medium',
          SIZE[size],
          PILL[entry.tone],
          className,
        )}
      >
        {text}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        SIZE[size],
        variant === 'glyph' ? TEXT[entry.tone] : 'text-foreground',
        className,
      )}
    >
      {Glyph ? (
        <Glyph className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <span className={cn('size-2 shrink-0 rounded-full', DOT[entry.tone])} aria-hidden="true" />
      )}
      {text}
    </span>
  )
}
