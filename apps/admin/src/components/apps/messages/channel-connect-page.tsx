'use client'

import { siteConfig } from '@commerce/config/site'
import { Bell, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import ProviderSettingsForm from '@/components/settings/provider-settings-form'
import { appsContent } from '@/data/apps'
import { messageAppsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ChannelId = 'ses' | 'whatsapp'

type ChannelConnectPageProps = {
  channelId: ChannelId
  /** Above the guide, e.g. WhatsApp's "Connect with Facebook". */
  lead?: ReactNode
}

/** The per-message switches ride along in the same blob untouched. */
type Extra = Record<never, never>

const loadOnly = (channelId: ChannelId) => async () => {
  const r = await api.store.getNotifications()
  return { ...r, available: r.available.filter((p) => p.id === channelId) }
}

/** Module scope so the form's load effect runs once per page, not on every render. */
const LOADERS = { ses: loadOnly('ses'), whatsapp: loadOnly('whatsapp') }

const save = (next: Parameters<typeof api.store.updateNotifications>[0]) =>
  api.store.updateNotifications(next)

/** Three plain steps and the one thing to watch out for, above the account fields. */
function guide(copy: typeof messageAppsContent, channelId: ChannelId) {
  const words = copy[channelId]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body font-medium text-foreground">{copy.stepsLabel}</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body text-foreground">
        {words.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="text-caption text-muted-foreground">{words.note}</p>
    </div>
  )
}

/**
 * Connect page of a message app (Amazon SES email, WhatsApp): its account
 * fields and on/off switch, from the same notifications settings Settings →
 * Notifications reads. Only this app's channel is shown.
 */
export default function ChannelConnectPage({ channelId, lead }: ChannelConnectPageProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(messageAppsContent)

  // Render logic
  const words = copy[channelId]

  return (
    <ProviderSettingsForm<Extra>
      title={words.title}
      intro={words.intro}
      icon={<Bell aria-hidden="true" />}
      load={LOADERS[channelId]}
      save={save}
      emptyExtra={{}}
      renderDescription={() => (
        <div className="flex flex-col gap-4">
          {lead}
          {guide(copy, channelId)}
        </div>
      )}
      headerActions={
        <Button
          variant="ghost"
          nativeButton={false}
          render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
        >
          {apps.viewGuide}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Button>
      }
      back={{ label: copy.back, href: routes.settings.notifications() }}
    />
  )
}
