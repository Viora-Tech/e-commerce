'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import { Truck } from '@commerce/ui/icons'
import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import SettingsSection from '@/components/settings/settings-section'
import ShippingPolicyFields from '@/components/settings/shipping-policy-fields'
import ShippingTryPin from '@/components/settings/shipping-try-pin'
import ShippingZonesCard from '@/components/shipping-zones/shipping-zones-card'
import { settingsContent } from '@/data/settings'
import { shippingSettingsContent as copy } from '@/data/shipping'
import { api } from '@/lib/api-client'

/** The policy arrives with the settings; until then there is nothing to render below the couriers. */
type Extra = { policy?: ShippingPolicySettings | undefined }

/**
 * Couriers with their own admin app (their own connect/credentials screen
 * and workspace) are dropped from the picker here; Settings → Shipping keeps
 * zones, rates and the store-wide dispatch policy only. Delhivery moved to
 * Apps → Delhivery.
 */
const OWN_APP_COURIERS = new Set(['delhivery'])

const load = async () => {
  const r = await api.store.getShipping()
  return { ...r, available: r.available.filter((p) => !OWN_APP_COURIERS.has(p.id)) }
}
const save = (next: Parameters<typeof api.store.updateShipping>[0]) =>
  api.store.updateShipping(next)

function courierHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  return hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null
}

function footer(extra: Extra, setExtra: (next: Extra) => void) {
  if (!extra.policy) return null
  const [, rates, policy, tryPin] = settingsContent.sections.shipping
  return (
    <>
      <SettingsSection id={rates?.id ?? 'section-rates'}>
        <ShippingZonesCard />
      </SettingsSection>
      <SettingsSection id={policy?.id ?? 'section-policy'}>
        <ShippingPolicyFields value={extra.policy} onChange={(policy) => setExtra({ policy })} />
      </SettingsSection>
      <SettingsSection id={tryPin?.id ?? 'section-try-pin'}>
        <ShippingTryPin />
      </SettingsSection>
    </>
  )
}

export default function ShippingSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      icon={<Truck aria-hidden="true" />}
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
