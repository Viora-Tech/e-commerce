'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AppStoreLink from '@/components/apps/app-store-link'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import HelpFooter from '@/components/payments/help-footer'
import BoxPresetsFields from '@/components/settings/box-presets-fields'
import CourierRuleFields from '@/components/settings/courier-rule-fields'
import HealthLine from '@/components/settings/health-line'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import ShippingPolicyFields from '@/components/settings/shipping-policy-fields'
import ShippingTryPin from '@/components/settings/shipping-try-pin'
import SplitShippingCard from '@/components/settings/split-shipping-card'
import WhatsThisHelp from '@/components/settings/whats-this-help'
import ShippingProfilesCard from '@/components/shipping-zones/shipping-profiles-card'
import { SETTINGS_BACK } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import DemoCourierSection from './demo-courier-section'

type Loaded = Awaited<ReturnType<typeof api.store.getShipping>>
type Settings = Loaded['settings']

/** The pretend courier for development; never counts as a real courier. */
const DEMO_COURIER = 'fake'

const DEV = process.env.NODE_ENV !== 'production'

/**
 * Settings → Shipping, Shopify-style (#147): the courier status line, then rows for where you
 * ship and what it costs, your packages, when orders go out, split shipping, which courier
 * ships and a pincode check, each opening in place (`?open=`; the old `#rates`-style anchors
 * open the same rows). Couriers themselves are connected in Apps; the demo courier is dev-only.
 */
export default function ShippingPage() {
  // Hooks
  const announceSetup = useSetupNext()
  const copy = useCopy(shippingSettingsContent)
  const rowsCopy = useCopy(settingsRowsContent)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.store.getShipping().then((r) => {
      setLoaded(r)
      setForm(r.settings)
      setSaved(JSON.stringify(r.settings))
    })
  }, [])

  // Helpers
  const patch = (next: Partial<Settings>) => setForm((f) => (f ? { ...f, ...next } : f))

  const labelOf = (id: string) => loaded?.available.find((p) => p.id === id)?.label ?? id

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const result = await api.store.updateShipping(form)
      const next = result ?? form
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
      void announceSetup('shipping')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as Settings)
  }

  const handleDemo = (on: boolean) =>
    setForm((f) =>
      f
        ? {
            ...f,
            enabled: on
              ? [...new Set([...f.enabled, DEMO_COURIER])]
              : f.enabled.filter((id) => id !== DEMO_COURIER),
          }
        : f,
    )

  // Early returns
  if (!loaded || !form) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    )
  }

  // Render logic
  const dirty = saved !== null && JSON.stringify(form) !== saved
  const couriers = form.enabled.filter((id) => id !== DEMO_COURIER).map(labelOf)
  const r = rowsCopy.shipping
  const rule = form.courierRule
  const rows = [
    { id: 'rates', title: r.rates, value: r.ratesValue },
    { id: 'boxes', title: r.packages, value: r.packagesValue(form.boxPresets.length) },
    {
      id: 'dispatch',
      title: r.dispatch,
      value: r.dispatchValue(form.policy.originPincode, form.policy.cutoff),
    },
    { id: 'split', title: r.split, value: r.splitValue(form.routing.maxParcels) },
    {
      id: 'courier',
      title: r.courier,
      value:
        rule.mode === 'preferred'
          ? r.preferred(labelOf(rule.providerId))
          : rule.mode === 'per_zone'
            ? r.perZone
            : r.cheapest,
    },
    { id: 'pincode', title: r.pincode, value: r.pincodeValue },
    ...(DEV
      ? [
          {
            id: 'demo',
            title: r.demo,
            value: form.enabled.includes(DEMO_COURIER) ? rowsCopy.on : rowsCopy.off,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {copy.intro}
            <WhatsThisHelp
              trigger={copy.whatsThis.trigger}
              title={copy.whatsThis.title}
              body={copy.whatsThis.body}
            />
          </span>
        }
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />

      <HealthLine
        tone={couriers.length > 0 ? 'ok' : 'warn'}
        title={couriers.length > 0 ? copy.health.ready(couriers.join(', ')) : copy.health.noCourier}
        help={couriers.length > 0 ? null : copy.health.noCourierHelp}
        action={
          couriers.length > 0 ? null : (
            <AppStoreLink category="shipping" variant="default">
              {copy.health.connect}
            </AppStoreLink>
          )
        }
      />

      <SettingsDrill rows={rows} backLabel={r.back}>
        <SettingsDrillPanel id="rates">
          <ShippingProfilesCard />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="boxes">
          <BoxPresetsFields
            value={form.boxPresets}
            onChange={(boxPresets) => patch({ boxPresets })}
          />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="dispatch">
          <ShippingPolicyFields value={form.policy} onChange={(policy) => patch({ policy })} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="split">
          <SplitShippingCard
            maxParcels={form.routing.maxParcels}
            onChange={(maxParcels) => patch({ routing: { ...form.routing, maxParcels } })}
          />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="courier">
          <CourierRuleFields
            value={form.courierRule}
            onChange={(courierRule) => patch({ courierRule })}
          />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="pincode">
          <ShippingTryPin />
        </SettingsDrillPanel>
        {DEV ? (
          <SettingsDrillPanel id="demo">
            <DemoCourierSection on={form.enabled.includes(DEMO_COURIER)} onChange={handleDemo} />
          </SettingsDrillPanel>
        ) : null}
      </SettingsDrill>
      <HelpFooter page="shipping" />
    </div>
  )
}
