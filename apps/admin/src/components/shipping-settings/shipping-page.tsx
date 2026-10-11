'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import HelpFooter from '@/components/payments/help-footer'
import BoxPresetsFields from '@/components/settings/box-presets-fields'
import CourierRuleFields from '@/components/settings/courier-rule-fields'
import HealthLine from '@/components/settings/health-line'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import ShippingPolicyFields from '@/components/settings/shipping-policy-fields'
import ShippingTryPin from '@/components/settings/shipping-try-pin'
import WhatsThisHelp from '@/components/settings/whats-this-help'
import ShippingZonesCard from '@/components/shipping-zones/shipping-zones-card'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DemoCourierSection from './demo-courier-section'

type Loaded = Awaited<ReturnType<typeof api.store.getShipping>>
type Settings = Loaded['settings']

/** The pretend courier for development; never counts as a real courier. */
const DEMO_COURIER = 'fake'

const DEV = process.env.NODE_ENV !== 'production'

type SectionProps = { id: string; children: ReactNode }

/**
 * Settings → Shipping in plain sections: where you ship and what it costs,
 * your boxes, when orders go out, which courier ships, and a pincode check.
 * Couriers themselves are connected in Apps; the demo courier is dev-only.
 */
export default function ShippingPage() {
  // Hooks
  const announceSetup = useSetupNext()
  const copy = useCopy(shippingSettingsContent)
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

  const handleDemoSaved = (next: Settings) => {
    setForm(next)
    setSaved(JSON.stringify(next))
  }

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
      <SettingsPageHeader
        title={copy.title}
        onSave={handleSave}
        dirty={dirty}
        saving={busy}
        saveLabel={copy.save}
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
      />

      <HealthLine
        tone={couriers.length > 0 ? 'ok' : 'warn'}
        title={couriers.length > 0 ? copy.health.ready(couriers.join(', ')) : copy.health.noCourier}
        help={couriers.length > 0 ? null : copy.health.noCourierHelp}
        action={
          couriers.length > 0 ? null : (
            <Button nativeButton={false} render={<Link href={routes.apps.list()} />}>
              {copy.health.connect}
            </Button>
          )
        }
      />

      <Section id="rates">
        <ShippingZonesCard />
      </Section>
      <Section id="boxes">
        <BoxPresetsFields
          value={form.boxPresets}
          onChange={(boxPresets) => patch({ boxPresets })}
        />
      </Section>
      <Section id="dispatch">
        <ShippingPolicyFields value={form.policy} onChange={(policy) => patch({ policy })} />
      </Section>
      <Section id="courier">
        <CourierRuleFields
          value={form.courierRule}
          onChange={(courierRule) => patch({ courierRule })}
        />
      </Section>
      <Section id="pincode">
        <ShippingTryPin />
      </Section>

      {DEV ? (
        <DemoCourierSection
          settings={form}
          dirty={dirty}
          onSaved={handleDemoSaved}
          demoId={DEMO_COURIER}
        />
      ) : null}
      <HelpFooter />
    </div>
  )
}

/** One block of the page, with an anchor the settings search links to. */
function Section({ id, children }: SectionProps) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-2">
      {children}
    </section>
  )
}
