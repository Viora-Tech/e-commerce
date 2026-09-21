'use client'

import { Text } from '@shopify/polaris'
import {
  type ProviderDef,
  ProviderSettingsForm,
} from '@/components/settings/provider-settings-form'
import { notificationsSettingsContent as copy } from '@/data/notifications'
import { api } from '@/lib/api-client'

type Extra = Record<never, never>

const load = () => api.store.getNotifications()
const save = (next: Parameters<typeof api.store.updateNotifications>[0]) =>
  api.store.updateNotifications(next)

function channelHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  if (!hint) return null
  return (
    <Text as="p" tone="subdued" variant="bodySm">
      {hint}
    </Text>
  )
}

export function NotificationsSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={channelHint}
      noConfigText={copy.hints.log}
    />
  )
}
