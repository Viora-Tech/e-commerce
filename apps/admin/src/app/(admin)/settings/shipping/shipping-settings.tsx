'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import ShippingPolicyFields from '@/components/settings/shipping-policy-fields'
import ShippingTryPin from '@/components/settings/shipping-try-pin'
import { settingsContent } from '@/data/settings'
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
  const [, policy, tryPin] = settingsContent.sections.shipping
  return (
    <>
      <section id={policy?.id} className="scroll-mt-20">
        <ShippingPolicyFields value={extra.policy} onChange={(policy) => setExtra({ policy })} />
      </section>
      <section id={tryPin?.id} className="scroll-mt-20">
        <ShippingTryPin />
      </section>
    </>
  )
}

export default function ShippingSettings() {
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
      sections={settingsContent.sections.shipping}
    />
  )
}
