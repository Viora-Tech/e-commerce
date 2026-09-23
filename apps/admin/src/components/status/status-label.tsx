import { cn } from '@commerce/ui/lib/utils'
import { type StatusKind, type StatusTone, type StatusValue, statusEntry } from '@/data/status'

type StatusLabelProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** `dot`: 8px dot + label (payment cell 5:2620). `glyph`: 24px glyph + coloured label (status cell 5:2624). `pill`: neutral chip with a status dot (Saleor pill). */
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
  info: 'text-ink-strong dark:text-teal-300',
  accent: 'text-link',
  neutral: 'text-muted-foreground',
}

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  pending: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-ink-strong dark:bg-teal-300',
  accent: 'bg-link',
  neutral: 'bg-muted-foreground-soft',
}

/* Saleor-style pill: a neutral chip on the hairline; only the 6px dot carries the tone. */
const PILL = 'border border-border bg-card text-foreground'

const SIZE = { sm: 'text-caption', md: 'text-body' } as const

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
          'inline-flex h-6 items-center gap-1.5 rounded-md pr-2 pl-1.5 font-medium whitespace-nowrap',
          SIZE[size],
          PILL,
          className,
        )}
      >
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[entry.tone])} />
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
