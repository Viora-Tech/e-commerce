'use client'

import type { SocialOverview } from '@commerce/core'
import { isLive, type MetaChannel, type SocialChannel } from '@commerce/core/sales-channels'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { chipStatus } from '@/lib/channel-status'
import { routes } from '@/lib/routes'
import ChannelLogo from './channel-logo'
import ChannelStatusChip from './channel-status-chip'

type MetaConnectionCardProps = {
  /** The page this card sits on. */
  channel: SocialChannel
  surfaces: SocialOverview['meta']
}

/**
 * Facebook, Instagram and WhatsApp share one Meta sign-in and catalog. Once one is on, the
 * others turn on here without signing in again; each keeps its own status and sales.
 */
export default function MetaConnectionCard({ channel, surfaces }: MetaConnectionCardProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.socialPage.meta)
  const names = useCopy(salesChannelsContent.social)
  const format = useFormat()
  const [busy, setBusy] = useState<MetaChannel | null>(null)

  // Event handlers
  const handleTurnOn = async (c: MetaChannel) => {
    setBusy(c)
    try {
      const r = await api.salesChannels.connect({
        channel: c,
        shares: ['catalog', 'prices'],
        account: null,
        catalog: 'all',
      })
      if (r.kind === 'redirect') return window.location.assign(r.url)
      toast.success(copy.joined(names[c].name))
      router.refresh()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  const signedIn = surfaces.some((s) => isLive(s.state) && s.state.status !== 'disconnected')
  return (
    <DataCard title={copy.title} subtitle={copy.subtitle} flush>
      <ul className="divide-y divide-border border-t border-border">
        {surfaces.map((s) => {
          const on = isLive(s.state) && s.state.status !== 'disconnected'
          return (
            // Wraps in the narrow side column instead of clipping at the right (audit #173).
            <li key={s.channel} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <ChannelLogo channel={s.channel} size="sm" />
              <div className="flex min-w-0 flex-1 basis-28 flex-col">
                <span className="truncate text-body font-medium">{names[s.channel].name}</span>
                <span className="text-caption text-muted-foreground">
                  {copy.sales(format.money(s.revenuePaise))}
                </span>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <ChannelStatusChip status={chipStatus(s.state)} />
                {s.channel === channel ? (
                  <span className="text-right text-caption text-muted-foreground">
                    {copy.thisPage}
                  </span>
                ) : signedIn && !on ? (
                  <KitButton
                    variant="pill"
                    disabled={busy !== null}
                    onClick={() => handleTurnOn(s.channel)}
                  >
                    {copy.turnOn}
                  </KitButton>
                ) : (
                  <KitButton variant="pill" href={routes.salesChannels.socialChannel(s.channel)}>
                    {copy.open}
                  </KitButton>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </DataCard>
  )
}
