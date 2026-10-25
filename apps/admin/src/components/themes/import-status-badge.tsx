import type { ImportStatus } from '@commerce/core/theme-import'
import StatusChip from '@/components/layout/status-chip'

type ImportStatusBadgeProps = {
  status: ImportStatus
  label: string
}

/** Done states stay neutral; only what needs the merchant (not yet, could not) is coloured. */
const TONE = {
  imported: 'neutral',
  replaced: 'neutral',
  unavailable: 'attention',
  unsupported: 'danger',
} as const satisfies Record<ImportStatus, 'neutral' | 'attention' | 'danger'>

/** The result chip of one imported section: exact, ours, not yet, or could not. */
export default function ImportStatusBadge({ status, label }: ImportStatusBadgeProps) {
  // Render logic
  return <StatusChip tone={TONE[status]}>{label}</StatusChip>
}
