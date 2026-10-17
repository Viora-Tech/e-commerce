import {
  type ChannelAttribution,
  channelOfAttribution,
  isAiAgent,
  type SalesChannelId,
} from '@commerce/core/sales-channels'
import { salesChannelsContent } from '@/data/sales-channels'

export type OrderChannel = { id: SalesChannelId; name: string; agent: boolean }

/** The AI agent or social channel an order came through, with its display name; null otherwise. */
export function orderChannel(
  attribution: ChannelAttribution | null | undefined,
): OrderChannel | null {
  const id = channelOfAttribution(attribution)
  if (!id) return null
  if (isAiAgent(id)) return { id, name: salesChannelsContent.agents[id].name, agent: true }
  return { id, name: salesChannelsContent.social[id].name, agent: false }
}
