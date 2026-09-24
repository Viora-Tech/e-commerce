import { cn } from '@commerce/ui/lib/utils'
import { type StatusKind, type StatusTone, type StatusValue, statusEntry } from '@/data/status'

type StatusLabelProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** `dot`: 8px dot + label (payment cell 5:2620). `glyph`: 24px glyph + coloured label (status cell 5:2624). `pill`: tinted chip with a thin tone border (Saleor pill). */
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

/* Saleor restraint: dots are neutral; only a problem state (unpaid, failed) is red. */
const DOT: Record<StatusTone, string> = {
  success: 'bg-muted-foreground-soft',
  pending: 'bg-muted-foreground-soft',
  error: 'bg-destructive',
  info: 'bg-muted-foreground-soft',
  accent: 'bg-muted-foreground-soft',
  neutral: 'bg-muted-foreground-soft',
}

/* Saleor pill: a thin border on a very light fill, ink text. Colour only for the key end
   states: done (fulfilled, delivered) is mint, a problem (cancelled, failed) is soft red. */
const PILL_NEUTRAL = 'border-border bg-muted/60'
const PILL_DONE = 'border-success/35 bg-success/10'
const PILL_PROBLEM = 'border-destructive/30 bg-destructive/8'
const DONE_VALUES = new Set(['fulfilled', 'delivered'])

function pillClass(tone: StatusTone, value: string): string {
  if (tone === 'error') return PILL_PROBLEM
  if (DONE_VALUES.has(value)) return PILL_DONE
  return PILL_NEUTRAL
}

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
          'inline-flex h-6 items-center rounded-md border px-2 font-medium whitespace-nowrap text-foreground',
          SIZE[size],
          pillClass(entry.tone, String(value)),
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
