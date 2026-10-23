import type { RunStatus } from '@commerce/core/automations'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { automationRunStatusContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'

type RunStatusChipProps = { status: RunStatus; variant?: 'soft' | 'dot' }

const TONE: Record<RunStatus, ChipTone> = {
  queued: 'info',
  running: 'info',
  waiting: 'attention',
  awaiting_approval: 'attention',
  completed: 'success',
  converted: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  skipped: 'neutral',
  stopped: 'neutral',
}

/** A run's status as a chip: mint done, amber waiting, red failed, grey ended or skipped. */
export default function RunStatusChip({ status, variant = 'dot' }: RunStatusChipProps) {
  // Hooks
  const copy = useCopy(automationRunStatusContent)

  // Render logic
  return (
    <StatusChip tone={TONE[status]} variant={variant}>
      {copy.run[status]}
    </StatusChip>
  )
}
