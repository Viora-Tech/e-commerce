'use client'

import StatusChip from '@/components/layout/status-chip'
import { type StatusKind, type StatusTone, type StatusValue, statusEntry } from '@/data/status'
import { useLocale } from '@/hooks/use-copy'
import { localizeStatusLabel } from '@/lib/status-labels'

type StatusLabelChipProps<K extends StatusKind> = {
  kind: K
  value: StatusValue<K> | (string & {})
}

type ChipTone = 'neutral' | 'attention' | 'info' | 'danger'

/** Finished and quiet states stay grey; only states that need someone to look get a colour. */
const CHIP_TONE: Record<StatusTone, ChipTone> = {
  success: 'neutral',
  neutral: 'neutral',
  accent: 'info',
  info: 'info',
  pending: 'attention',
  error: 'danger',
}

/** A `StatusChip` for any mapped status: the same labels as `StatusLabel`, the Proofly colour rule. */
export default function StatusLabelChip<K extends StatusKind>({
  kind,
  value,
}: StatusLabelChipProps<K>) {
  // Hooks
  const locale = useLocale()

  // Render logic
  const entry = statusEntry(kind, value)

  return (
    <StatusChip tone={CHIP_TONE[entry.tone]}>{localizeStatusLabel(entry.label, locale)}</StatusChip>
  )
}
