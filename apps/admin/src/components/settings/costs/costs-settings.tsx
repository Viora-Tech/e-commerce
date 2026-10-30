'use client'

import { permissions } from '@commerce/core/permissions'
import {
  type FeeRate,
  METHOD_RATE_IDS,
  type MethodRateId,
  type ProfitCostSettings,
  STANDARD_METHOD_FEES,
} from '@commerce/core/profit'
import { parseRupees } from '@commerce/money'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import { profitCostsContent } from '@/data/profit-costs'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import FeeRateRow, { type FeeRateText } from './fee-rate-row'

type View = Awaited<ReturnType<typeof api.profitCosts.get>>
type Form = {
  methods: Record<MethodRateId, FeeRateText>
  gateways: Record<string, FeeRateText>
  cod: FeeRateText
  delivery: string
}

const COD = 'cod'

const toText = (rate: FeeRate | null | undefined): FeeRateText => ({
  percent: rate ? String(rate.percentBps / 100) : '',
  fixed: rate && rate.fixedPaise > 0 ? String(rate.fixedPaise / 100) : '',
})

/** Typed text as a rate; null when blank (no rate), undefined when it is not a valid rate. */
function toRate(text: FeeRateText): FeeRate | null | undefined {
  if (!text.percent.trim() && !text.fixed.trim()) return null
  const percent = text.percent.trim() ? Number(text.percent) : 0
  const fixed = text.fixed.trim() ? parseRupees(text.fixed) : 0
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || fixed === null) return undefined
  return { percentBps: Math.round(percent * 100), fixedPaise: fixed }
}

const filled = (text: FeeRateText) => Boolean(text.percent.trim() || text.fixed.trim())

/** A rate as the row shows it: "2%", "₹30" or "2% + ₹30"; null when blank. */
function rateLine(text: FeeRateText, money: (paise: number) => string): string | null {
  const fixed = text.fixed.trim() ? parseRupees(text.fixed) : null
  const parts = [
    text.percent.trim() ? `${text.percent.trim()}%` : null,
    fixed ? money(fixed) : null,
  ]
  const line = parts.filter(Boolean).join(' + ')
  return line || null
}

const methodsText = (fees: ProfitCostSettings['methodFees']) =>
  Object.fromEntries(METHOD_RATE_IDS.map((id) => [id, toText(fees[id])])) as Form['methods']

const formOf = (view: View): Form => ({
  methods: methodsText(view.costs.methodFees),
  gateways: Object.fromEntries(view.gateways.map((id) => [id, toText(view.costs.gatewayFees[id])])),
  cod: toText(view.costs.codFee),
  delivery: String(view.costs.defaultDeliveryPaise / 100),
})

/**
 * Settings › Costs for profit, Shopify-style (#147): rows for the fee rates used until the
 * gateway reports the actual fee (by how the customer paid, by gateway), the default delivery
 * cost and the courier's cash on delivery fee, each opening in place (`?open=`).
 */
export default function CostsSettings() {
  // Hooks
  const copy = useCopy(profitCostsContent)
  const rowsCopy = useCopy(settingsRowsContent)
  const fmt = useFormat()
  const { general } = useCopy(settingsContent)
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.profitCosts.get().then((v) => {
      setView(v)
      setForm(formOf(v))
    })
  }, [])

  // Helpers
  const nameOf = (id: string) =>
    id === COD
      ? copy.cod.label
      : (copy.methods.names[id] ??
        copy.methodNames[id] ??
        `${id.charAt(0).toUpperCase()}${id.slice(1)}`)

  // Event handlers
  const handleSave = async () => {
    if (!view || !form) return
    const methodFees: ProfitCostSettings['methodFees'] = {}
    for (const id of METHOD_RATE_IDS) {
      const rate = toRate(form.methods[id])
      if (rate === undefined) {
        toast.error(copy.invalid(nameOf(id)))
        return
      }
      if (rate) methodFees[id] = rate
    }
    const gatewayFees: ProfitCostSettings['gatewayFees'] = { ...view.costs.gatewayFees }
    for (const [id, text] of Object.entries(form.gateways)) {
      const rate = toRate(text)
      if (rate === undefined) {
        toast.error(copy.invalid(nameOf(id)))
        return
      }
      if (rate) gatewayFees[id] = rate
      else delete gatewayFees[id]
    }
    const codFee = toRate(form.cod)
    if (codFee === undefined) {
      toast.error(copy.invalid(nameOf(COD)))
      return
    }
    const defaultDeliveryPaise = parseRupees(form.delivery)
    if (defaultDeliveryPaise === null) {
      toast.error(copy.delivery.invalid)
      return
    }
    setBusy(true)
    try {
      const costs = await api.profitCosts.save({
        methodFees,
        gatewayFees,
        codFee,
        defaultDeliveryPaise,
      })
      const next = { ...view, costs }
      setView(next)
      setForm(formOf(next))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDiscard = () => {
    if (view) setForm(formOf(view))
  }
  const handleStandardRates = () => {
    setForm((f) => (f ? { ...f, methods: methodsText(STANDARD_METHOD_FEES) } : f))
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const dirty = !!view && !!form && JSON.stringify(form) !== JSON.stringify(formOf(view))
  const gstNote = view?.gstClaimable ? copy.gst.claimable : copy.gst.notClaimable
  const deliveryPaise = form ? parseRupees(form.delivery) : null
  const rows =
    view && form
      ? [
          ...(view.methodRatesOn
            ? [
                {
                  id: 'methods',
                  title: copy.methods.heading,
                  value: rowsCopy.costs.ratesSet(
                    METHOD_RATE_IDS.filter((id) => filled(form.methods[id])).length,
                    METHOD_RATE_IDS.length,
                  ),
                },
              ]
            : []),
          {
            id: 'gateways',
            title: copy.gateways.heading,
            value:
              view.gateways.length === 0
                ? rowsCopy.costs.noGateways
                : rowsCopy.costs.ratesSet(
                    view.gateways.filter((id) =>
                      filled(form.gateways[id] ?? { percent: '', fixed: '' }),
                    ).length,
                    view.gateways.length,
                  ),
          },
          {
            id: 'delivery',
            title: copy.delivery.heading,
            value: deliveryPaise === null ? rowsCopy.needsFix : fmt.money(deliveryPaise),
          },
          ...(view.codOn
            ? [
                {
                  id: 'cod-fee',
                  title: copy.cod.heading,
                  value: rateLine(form.cod, fmt.money) ?? rowsCopy.notSet,
                },
              ]
            : []),
        ]
      : []

  return (
    <div className="flex flex-col gap-6">
      <SaveBar
        open={dirty}
        message={general.unsaved}
        saveLabel={copy.save}
        discardLabel={general.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />
      {!view || !form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <SettingsDrill rows={rows} backLabel={copy.title}>
          {view.methodRatesOn ? (
            <SettingsDrillPanel id="methods">
              <SettingsCard title={copy.methods.heading} description={copy.methods.help}>
                {METHOD_RATE_IDS.map((id) => (
                  <FeeRateRow
                    key={id}
                    id={`fee-method-${id}`}
                    label={nameOf(id)}
                    value={form.methods[id]}
                    disabled={!canManage || busy}
                    onChange={(value) =>
                      setForm((f) => (f ? { ...f, methods: { ...f.methods, [id]: value } } : f))
                    }
                  />
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <p className="text-caption text-muted-foreground">{gstNote}</p>
                  {canManage ? (
                    <Button variant="outline" onClick={handleStandardRates} disabled={busy}>
                      {copy.methods.reset}
                    </Button>
                  ) : null}
                </div>
              </SettingsCard>
            </SettingsDrillPanel>
          ) : null}
          <SettingsDrillPanel id="gateways">
            <SettingsCard title={copy.gateways.heading} description={copy.gateways.help}>
              {view.gateways.length === 0 ? (
                <p className="text-body text-muted-foreground">{copy.gateways.none}</p>
              ) : (
                view.gateways.map((id) => (
                  <FeeRateRow
                    key={id}
                    id={`fee-${id}`}
                    label={nameOf(id)}
                    value={form.gateways[id] ?? { percent: '', fixed: '' }}
                    disabled={!canManage || busy}
                    onChange={(value) =>
                      setForm((f) => (f ? { ...f, gateways: { ...f.gateways, [id]: value } } : f))
                    }
                  />
                ))
              )}
              {view.methodRatesOn ? null : (
                <p className="pt-4 text-caption text-muted-foreground">{gstNote}</p>
              )}
            </SettingsCard>
          </SettingsDrillPanel>
          <SettingsDrillPanel id="delivery">
            <SettingsCard
              id="delivery-cost"
              title={copy.delivery.heading}
              description={copy.delivery.help}
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="default-delivery" className="text-caption text-muted-foreground">
                  {copy.delivery.label}
                </label>
                <Input
                  size="lg"
                  id="default-delivery"
                  inputMode="decimal"
                  className="w-36"
                  value={form.delivery}
                  disabled={!canManage || busy}
                  onChange={(e) => setForm((f) => (f ? { ...f, delivery: e.target.value } : f))}
                />
                <p className="text-caption text-muted-foreground">
                  {view.gstClaimable ? copy.delivery.gstClaimable : copy.delivery.gstNotClaimable}
                </p>
              </div>
            </SettingsCard>
          </SettingsDrillPanel>
          {view.codOn ? (
            <SettingsDrillPanel id="cod-fee">
              <SettingsCard title={copy.cod.heading} description={copy.cod.help}>
                <FeeRateRow
                  id="fee-cod"
                  label={copy.cod.label}
                  value={form.cod}
                  disabled={!canManage || busy}
                  onChange={(cod) => setForm((f) => (f ? { ...f, cod } : f))}
                />
              </SettingsCard>
            </SettingsDrillPanel>
          ) : null}
        </SettingsDrill>
      )}
    </div>
  )
}
