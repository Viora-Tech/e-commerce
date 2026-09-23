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

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  pending: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-ink-strong dark:bg-teal-300',
  accent: 'bg-link',
  neutral: 'bg-muted-foreground-soft',
}

/* Saleor pill (the mint "Fulfilled" chip): a faint tint of the tone, a thin border in the
   same tone, ink text. The only colour most pages carry. */
const PILL: Record<StatusTone, string> = {
  success: 'border-success/35 bg-success/10',
  pending: 'border-warning/50 bg-warning/15',
  error: 'border-destructive/35 bg-destructive/10',
  info: 'border-border bg-muted',
  accent: 'border-info/35 bg-info/10',
  neutral: 'border-border bg-muted',
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
