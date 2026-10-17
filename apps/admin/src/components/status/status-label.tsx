'use client'

import { cn } from '@commerce/ui/lib/utils'
import { CHIP_DOT, CHIP_TEXT, toneFor } from '@/components/status/tone'
import { type StatusKind, type StatusValue, statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'

type StatusLabelProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** `dot`: 8px dot + label (payment cell 5:2620). `glyph`: 24px glyph + coloured label (status cell 5:2624). */
  variant?: 'dot' | 'glyph'
  size?: 'sm' | 'md'
  /** Overrides the mapped label (e.g. raw gateway text). */
  label?: string | undefined
  className?: string
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
  // Hooks
  const locale = useLocale()

  // Render logic
  const entry = statusEntry(kind, value)
  const text = label ?? localizeStatusLabel(entry.label, locale)
  const Glyph = variant === 'glyph' ? entry.glyph : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        SIZE[size],
        variant === 'glyph' ? CHIP_TEXT[toneFor(entry.tone)] : 'text-foreground',
        className,
      )}
    >
      {Glyph ? (
        <Glyph className="size-6 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className={cn('size-2 shrink-0 rounded-full', CHIP_DOT[toneFor(entry.tone)])}
          aria-hidden="true"
        />
      )}
      {text}
    </span>
  )
}
