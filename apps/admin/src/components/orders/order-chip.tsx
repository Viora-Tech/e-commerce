'use client'

import StatusChip from '@/components/layout/status-chip'
import { type StatusKind, type StatusTone, type StatusValue, statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'

type OrderChipProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** Overrides the mapped label (raw gateway text). */
  label?: string | undefined
  className?: string
}

/* Colour only where someone has to act: waiting is amber, a problem red, in transit blue.
   Done and quiet states (paid, fulfilled, completed, cancelled) stay a grey chip with a border. */
const TONE: Record<StatusTone, 'neutral' | 'attention' | 'info' | 'danger'> = {
  success: 'neutral',
  pending: 'attention',
  error: 'danger',
  info: 'info',
  accent: 'neutral',
  neutral: 'neutral',
}

/** A status as the Proofly chip: the one place order, payment and fulfilment states get their tone. */
export default function OrderChip<K extends StatusKind>({
  kind,
  value,
  label,
  className,
}: OrderChipProps<K>) {
  // Hooks
  const locale = useLocale()

  // Render logic
  const entry = statusEntry(kind, value)

  return (
    <StatusChip tone={TONE[entry.tone]} className={className}>
      {label ?? localizeStatusLabel(entry.label, locale)}
    </StatusChip>
  )
}
