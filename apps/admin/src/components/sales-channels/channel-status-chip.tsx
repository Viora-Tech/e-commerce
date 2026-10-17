'use client'

import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'

export type ChannelStatus = keyof typeof salesChannelsContent.status

const TONE: Record<ChannelStatus, ChipTone> = {
  connected: 'success',
  requested: 'attention',
  not_connected: 'neutral',
  attention: 'danger',
  syncing: 'info',
  paused: 'attention',
}

type ChannelStatusChipProps = { status: ChannelStatus }

/** A channel's connection state: Connected, Waiting for approval, Not connected… */
export default function ChannelStatusChip({ status }: ChannelStatusChipProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.status)

  // Render logic
  return (
    <StatusChip tone={TONE[status]} variant="dot">
      {copy[status]}
    </StatusChip>
  )
}
