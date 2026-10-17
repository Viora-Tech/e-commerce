'use client'

import type { ChannelState } from '@commerce/core/sales-channels'
import KitButton from '@/components/kit/kit-button'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { channelBar } from '@/lib/channel-status'
import SyncStatusBar from './sync-status-bar'

type ChannelBarProps = {
  state: ChannelState
  name: string
  onReconnect: () => void
  onWithdraw: () => void
}

/** The sync status bar for one channel, in whatever state its connection is in. */
export default function ChannelBar({ state, name, onReconnect, onWithdraw }: ChannelBarProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent)
  const format = useFormat()

  // Render logic
  const bar = channelBar(state, name, copy, (iso) => format.date(iso))
  const meta = bar.metaAt
    ? bar.metaKind === 'started'
      ? copy.bar.started(format.ago(bar.metaAt))
      : copy.bar.lastTried(format.ago(bar.metaAt))
    : undefined

  return (
    <SyncStatusBar
      tone={bar.tone}
      title={bar.title}
      detail={bar.detail}
      meta={meta}
      progress={bar.progress}
      action={
        bar.action === 'reconnect' ? (
          <KitButton onClick={onReconnect}>{copy.bar.reconnect}</KitButton>
        ) : bar.action === 'withdraw' ? (
          <KitButton variant="secondary" onClick={onWithdraw}>
            {copy.card.viewRequest}
          </KitButton>
        ) : undefined
      }
    />
  )
}
