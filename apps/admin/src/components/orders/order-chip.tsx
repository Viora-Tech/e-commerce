'use client'

import StatusChip from '@/components/layout/status-chip'
import { toneFor } from '@/components/status/tone'
import { type StatusKind, type StatusValue, statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'

type OrderChipProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
  /** Overrides the mapped label (raw gateway text). */
  label?: string | undefined
  className?: string
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
    <StatusChip tone={toneFor(entry.tone)} className={className}>
      {label ?? localizeStatusLabel(entry.label, locale)}
    </StatusChip>
  )
}
