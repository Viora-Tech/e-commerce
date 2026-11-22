'use client'

import { lowestEmiPaise } from '@commerce/core/emi'
import { EMI_GATEWAYS, type EmiGateway } from '@commerce/plugin-emi/offer'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import NoticeBar from '@/components/layout/notice-bar'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { appsContent } from '@/data/apps'
import { emiContent } from '@/data/emi'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

type View = Awaited<ReturnType<typeof api.emi.settings.get>>
type Settings = View['settings']

/** Example price for the preview: ₹12,000, or the merchant's minimum when that is higher. */
const PREVIEW_PAISE = 1_200_000

const GATEWAY_LINKS: Record<EmiGateway, string> = {
  razorpay: '/apps/razorpay',
  cashfree: '/apps/cashfree',
}

/** On/off, which gateway, lowest price, and a preview of the shopper's line. */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(emiContent)
  const apps = useCopy(appsContent)
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` is Try again
  useEffect(() => {
    setLoadFailed(false)
    api.emi.settings.get().then(
      (v) => {
        setView(v)
        setForm(v.settings)
      },
      () => setLoadFailed(true),
    )
  }, [loadAttempt])

  // Derived
  /** The one thing to tell (and, when something is missing, the one link to fix it). */
  function statusOf(view: View) {
    const gateway = copy.gateway.options[view.settings.gateway].label
    switch (view.readiness) {
      case 'ready':
        return { text: copy.status.ready, link: null }
      case 'off':
        return { text: copy.status.off, link: null }
      case 'gateway-not-set-up':
        return {
          text: copy.status.gatewayNotSetUp(gateway),
          link: {
            href: GATEWAY_LINKS[view.settings.gateway],
            label: copy.status.gatewaySetUpLink(gateway),
          },
        }
      default:
        return {
          text: copy.status.emiOff,
          link: { href: routes.settings.payments(), label: copy.status.emiOffLink },
        }
    }
  }

  // Helpers
  const patch = (next: Partial<Settings>) => setForm((f) => (f ? { ...f, ...next } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.emi.settings.save(form)
      setView(next)
      setForm(next.settings)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => setForm(view?.settings ?? null)

  const handleMinPrice = (value: string) => {
    const rupees = Math.min(1_000_000, Number(value.replace(/\D/g, '')) || 0)
    patch({ minPricePaise: rupees * 100 })
  }

  // Early returns
  if ((!view || !form) && loadFailed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.settings}
        onRetry={() => setLoadAttempt((n) => n + 1)}
      />
    )
  }
  if (!view || !form) return <SectionPageSkeleton cards={2} />

  // Render logic
  const status = statusOf(view)
  const examplePaise = Math.max(PREVIEW_PAISE, form.minPricePaise)
  const usesWidget = form.gateway === 'razorpay' && view.officialWidget
  const dirty = JSON.stringify(form) !== JSON.stringify(view.settings)

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
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <NoticeBar>
        {status.text}{' '}
        {status.link ? (
          <Link href={status.link.href} className="font-medium underline">
            {status.link.label}
          </Link>
        ) : null}
      </NoticeBar>
      <SettingsCard>
        <SettingsRow label={copy.show.label} description={copy.show.help} htmlFor="emi-enabled">
          <Switch
            id="emi-enabled"
            checked={form.enabled}
            onCheckedChange={(v) => patch({ enabled: v })}
          />
        </SettingsRow>
        <SettingsRow label={copy.gateway.title} description={copy.gateway.help}>
          <RadioGroup
            value={form.gateway}
            onValueChange={(v) => patch({ gateway: v as EmiGateway })}
          >
            {EMI_GATEWAYS.map((id) => (
              <label key={id} htmlFor={`emi-gateway-${id}`} className="flex items-start gap-2">
                <RadioGroupItem id={`emi-gateway-${id}`} value={id} className="mt-0.5" />
                <span className="flex flex-col">
                  <span className="text-body">{copy.gateway.options[id].label}</span>
                  <span className="text-caption text-muted-foreground">
                    {copy.gateway.options[id].help}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </SettingsRow>
        <SettingsRow
          label={copy.minPrice.label}
          description={copy.minPrice.help}
          htmlFor="emi-min-price"
        >
          <Input
            id="emi-min-price"
            inputMode="numeric"
            className="max-w-40"
            value={String(Math.round(form.minPricePaise / 100))}
            onChange={(e) => handleMinPrice(e.target.value)}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.preview.title}
          description={copy.preview.example(formatPaise(examplePaise))}
        >
          <span className="text-body text-primary">
            {copy.preview.line(formatPaise(lowestEmiPaise(examplePaise)))}
          </span>
          <span className="text-caption text-muted-foreground">
            {usesWidget ? copy.gateway.officialWidget : copy.gateway.simpleLine} {copy.preview.note}
          </span>
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}
