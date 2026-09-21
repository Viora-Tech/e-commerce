'use client'

import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import { notificationsSettingsContent as copy } from '@/data/notifications'
import { api } from '@/lib/api-client'

type Extra = Record<never, never>

const load = () => api.store.getNotifications()
const save = (next: Parameters<typeof api.store.updateNotifications>[0]) =>
  api.store.updateNotifications(next)

function channelHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  return hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null
}

export default function NotificationsSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={channelHint}
      noConfigText={copy.hints.log}
    />
  )
}
