'use client'

import { defaultShippingSettings, type ShippingPolicySettings } from '@commerce/core'
import { Text } from '@shopify/polaris'
import {
  type ProviderDef,
  ProviderSettingsForm,
} from '@/components/settings/provider-settings-form'
import { ShippingPolicyFields } from '@/components/settings/shipping-policy-fields'
import { ShippingTryPin } from '@/components/settings/shipping-try-pin'
import { shippingSettingsContent as copy } from '@/data/shipping'
import { api } from '@/lib/api-client'

type Extra = { policy: ShippingPolicySettings }

const load = () => api.store.getShipping()
const save = (next: Parameters<typeof api.store.updateShipping>[0]) =>
  api.store.updateShipping(next)

function courierHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  if (!hint) return null
  return (
    <Text as="p" tone="subdued" variant="bodySm">
      {hint}
    </Text>
  )
}

function footer(extra: Extra, setExtra: (next: Extra) => void) {
  return (
    <>
      <ShippingPolicyFields value={extra.policy} onChange={(policy) => setExtra({ policy })} />
      <ShippingTryPin />
    </>
  )
}

export function ShippingSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      load={load}
      save={save}
      emptyExtra={{ policy: defaultShippingSettings.policy }}
      renderHint={courierHint}
      renderFooter={footer}
      noConfigText={copy.hints.fake}
    />
  )
}
