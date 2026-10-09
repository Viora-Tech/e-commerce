'use client'

import { Bell } from '@commerce/ui/icons'
import ProviderSettingsForm from '@/components/settings/provider-settings-form'
import { messageAppsContent as copy } from '@/data/notifications'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ChannelId = 'ses' | 'whatsapp'

type ChannelConnectPageProps = { channelId: ChannelId }

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
function guide(channelId: ChannelId) {
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
export default function ChannelConnectPage({ channelId }: ChannelConnectPageProps) {
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
      renderDescription={() => guide(channelId)}
      back={{ label: copy.back, href: routes.settings.notifications() }}
    />
  )
}
