'use client'

import type { RolloutView } from '@commerce/core'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'

type RolloutStatus = RolloutView['status']

type RolloutStatusChipProps = {
  status: RolloutStatus
}

const TONE: Record<RolloutStatus, ChipTone> = {
  active: 'success',
  scheduled: 'info',
  paused: 'attention',
  draft: 'neutral',
  ended: 'neutral',
  archived: 'neutral',
}

/** A rollout's status: running green, waiting to start blue, paused amber, the rest quiet. */
export default function RolloutStatusChip({ status }: RolloutStatusChipProps) {
  // Hooks
  const copy = useCopy(rolloutsContent)

  return <StatusChip tone={TONE[status]}>{copy.status[status]}</StatusChip>
}
