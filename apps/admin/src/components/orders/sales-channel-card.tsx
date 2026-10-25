'use client'

import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import type { OrderChannel } from '@/lib/order-channel'
import { routes } from '@/lib/routes'

type SalesChannelCardProps = {
  channel: OrderChannel
  /** Where the visit came from, as recorded on the order (referrer host or utm source). */
  cameFrom: string | null
  campaign: string | null
}

/** Figma "Agentic sales · Order from an agent": which agent or social channel sold this order. */
export default function SalesChannelCard({ channel, cameFrom, campaign }: SalesChannelCardProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.orderCard)

  // Render logic
  return (
    <DataCard
      title={copy.title(channel.name)}
      action={
        <KitButton
          variant="linkSm"
          href={
            channel.agent
              ? routes.salesChannels.agentic()
              : routes.salesChannels.socialChannel(channel.id)
          }
        >
          {channel.agent ? copy.agentic : copy.social}
        </KitButton>
      }
    >
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.channel, value: channel.agent ? copy.agentic : copy.social },
          { label: copy.checkout, value: copy.onStore },
          { label: copy.cameFrom, value: cameFrom ?? copy.unknown, hidden: !cameFrom },
          { label: copy.campaign, value: campaign ?? '', hidden: !campaign },
        ]}
      />
    </DataCard>
  )
}
