'use client'

import { Inbox, MessageSquare } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import OrderChip from '@/components/orders/order-chip'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { ChannelStatusData } from './types'

type SendingCardProps = {
  email: ChannelStatusData
  whatsapp: ChannelStatusData
  /** Email goes out through the platform account when no email app is connected. */
  platformEmail: boolean
}

const ICONS = { email: Inbox, whatsapp: MessageSquare }

/** "How messages are sent": Email and WhatsApp, whether each is connected, and one button. */
export default function SendingCard({ email, whatsapp, platformEmail }: SendingCardProps) {
  // Hooks
  const { sending: copy } = useCopy(notificationsSettingsContent)
  const router = useRouter()
  const [opening, setOpening] = useState<string | null>(null)

  // Event handlers
  const handleConnect = async (channel: ChannelStatusData) => {
    setOpening(channel.appId)
    try {
      if (channel.state === 'missing') await api.apps.install({ id: channel.appId })
      router.push(`/apps/${channel.appId}/connect`)
      // A just-installed app gets its sidebar link from the server layout.
      router.refresh()
    } catch {
      toast.error(copy.installFailed)
      setOpening(null)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border">
        {[email, whatsapp].map((c) => {
          const Icon = ICONS[c.kind]
          const words = copy[c.kind]
          const connected = c.state === 'connected'
          // Email already works through the platform; the app becomes an optional upgrade.
          const viaPlatform = c.kind === 'email' && !connected && platformEmail
          return (
            <div
              key={c.kind}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-medium text-foreground">{words.name}</p>
                    <OrderChip
                      kind="app"
                      value={connected || viaPlatform ? 'connected' : 'notConnected'}
                      label={viaPlatform ? copy.state.platform : copy.state[c.state]}
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {viaPlatform ? copy.platformHelp : `${words.via} · ${words.help}`}
                  </p>
                  {c.kind === 'whatsapp' && connected && c.testMode ? (
                    <p className="text-caption text-warning-foreground dark:text-warning">
                      {copy.testMode}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                variant={connected || viaPlatform ? 'outline' : 'default'}
                className="w-full sm:w-auto"
                disabled={opening === c.appId}
                onClick={() => handleConnect(c)}
              >
                {opening === c.appId ? <Spinner /> : null}
                {connected ? copy.manage : viaPlatform ? copy.useOwn : copy.connect}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
