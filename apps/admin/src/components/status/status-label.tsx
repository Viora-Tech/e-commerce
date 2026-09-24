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

/* Meaning carries colour (Saleor reference): done is mint, in transit/refund is blue,
   waiting is amber, a problem is red. Only the neutral/accent tones stay ink. */
const TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  pending: 'text-warning-foreground dark:text-warning',
  error: 'text-danger',
  info: 'text-info',
  accent: 'text-link',
  neutral: 'text-muted-foreground',
}

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  pending: 'bg-warning',
  error: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-primary',
  neutral: 'bg-muted-foreground-soft',
}

/* Pill: a thin tone border on a soft tone fill, ink text; neutral/accent stay a plain grey chip. */
const PILL: Record<StatusTone, string> = {
  success: 'border-success/30 bg-success-soft',
  pending: 'border-warning/35 bg-warning-soft',
  error: 'border-danger/30 bg-danger-soft',
  info: 'border-info/30 bg-info-soft',
  accent: 'border-border bg-muted/60',
  neutral: 'border-border bg-muted/60',
}

function pillClass(tone: StatusTone): string {
  return PILL[tone]
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
          pillClass(entry.tone),
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
        <Glyph className="size-6 shrink-0" aria-hidden="true" />
      ) : (
        <span className={cn('size-2 shrink-0 rounded-full', DOT[entry.tone])} aria-hidden="true" />
      )}
      {text}
    </span>
  )
}
