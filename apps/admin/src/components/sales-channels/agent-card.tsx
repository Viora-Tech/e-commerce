'use client'

import {
  type AiAgent,
  type ChannelState,
  isLive,
  needsReconnect,
} from '@commerce/core/sales-channels'
import KitButton from '@/components/kit/kit-button'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { agentChipStatus, channelAction } from '@/lib/channel-status'
import ChannelLogo from './channel-logo'
import ChannelStatusChip from './channel-status-chip'

type AgentCardProps = {
  agent: AiAgent
  state: ChannelState
  orders: number
  onConnect: () => void
  onViewRequest: () => void
}

/** Figma "Channel card": an AI agent, its state, what it sees and sells, and the next step. */
export default function AgentCard({
  agent,
  state,
  orders,
  onConnect,
  onViewRequest,
}: AgentCardProps) {
  // Hooks
  const info = useCopy(salesChannelsContent.agents[agent])
  const copy = useCopy(salesChannelsContent.card)
  const format = useFormat()

  // Render logic
  const action = channelAction(state)
  const visible = isLive(state) ? (state.sync.sent ?? state.sync.total) : null
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-card bg-[image:var(--card-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <ChannelLogo channel={agent} />
        <ChannelStatusChip status={agentChipStatus(state)} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold text-ink-strong">{info.name}</h3>
        <p className="text-caption text-muted-foreground">{info.blurb}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-caption">
        <div>
          <dt className="text-muted-foreground">{copy.productsVisible}</dt>
          {/* Nothing is visible to an agent before it is approved, or while access is lost. */}
          <dd className="font-medium text-foreground tabular-nums">
            {visible != null && !needsReconnect(state) ? format.number(visible) : copy.none}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.orders30}</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {orders > 0 ? format.number(orders) : copy.none}
          </dd>
        </div>
      </dl>
      {action === 'view_request' || action === 'manage' ? (
        <KitButton variant="secondary" className="w-full" onClick={onViewRequest}>
          {action === 'manage' ? copy.manage : copy.viewRequest}
        </KitButton>
      ) : (
        <KitButton className="w-full" onClick={onConnect}>
          {action === 'reconnect' ? copy.reconnect : copy.connect}
        </KitButton>
      )}
    </article>
  )
}
