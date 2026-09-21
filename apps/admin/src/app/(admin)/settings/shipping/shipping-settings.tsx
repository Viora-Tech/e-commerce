'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import {
  type ProviderDef,
  ProviderSettingsForm,
} from '@/components/settings/provider-settings-form'
import { ShippingPolicyFields } from '@/components/settings/shipping-policy-fields'
import { ShippingTryPin } from '@/components/settings/shipping-try-pin'
import { shippingSettingsContent as copy } from '@/data/shipping'
import { api } from '@/lib/api-client'

/** The policy arrives with the settings; until then there is nothing to render below the couriers. */
type Extra = { policy?: ShippingPolicySettings | undefined }

const load = () => api.store.getShipping()
const save = (next: Parameters<typeof api.store.updateShipping>[0]) =>
  api.store.updateShipping(next)

function courierHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  return hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null
}

function footer(extra: Extra, setExtra: (next: Extra) => void) {
  if (!extra.policy) return null
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
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={courierHint}
      renderFooter={footer}
      noConfigText={copy.hints.fake}
    />
  )
}
