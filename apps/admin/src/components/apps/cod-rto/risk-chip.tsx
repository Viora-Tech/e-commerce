import type { RiskLevel } from '@commerce/core/cod-rto'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'

type RiskChipProps = {
  level: RiskLevel
  /** Already in the member's language. */
  label: string
  score?: number | null | undefined
}

const TONE: Record<RiskLevel, ChipTone> = { low: 'success', medium: 'attention', high: 'danger' }

/** An order's RTO risk level, with its score when given ("High risk · 72"). */
export default function RiskChip({ level, label, score }: RiskChipProps) {
  // Render logic
  return (
    <StatusChip tone={TONE[level]}>
      {label}
      {score === null || score === undefined ? null : (
        <span className="tabular-nums">{` · ${score}`}</span>
      )}
    </StatusChip>
  )
}
