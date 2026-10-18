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
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import { profitCostsContent } from '@/data/profit-costs'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import FeeRateRow, { type FeeRateText } from './fee-rate-row'

type View = Awaited<ReturnType<typeof api.profitCosts.get>>
type Form = {
  methods: Record<MethodRateId, FeeRateText>
  gateways: Record<string, FeeRateText>
  cod: FeeRateText
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

const methodsText = (fees: ProfitCostSettings['methodFees']) =>
  Object.fromEntries(METHOD_RATE_IDS.map((id) => [id, toText(fees[id])])) as Form['methods']

const formOf = (view: View): Form => ({
  methods: methodsText(view.costs.methodFees),
  gateways: Object.fromEntries(view.gateways.map((id) => [id, toText(view.costs.gatewayFees[id])])),
  cod: toText(view.costs.codFee),
})

/**
 * Settings › Costs for profit: the fee rates used until the gateway reports the actual fee,
 * by how the customer paid, by gateway, and the courier's cash on delivery fee.
 */
export default function CostsSettings() {
  // Hooks
  const copy = useCopy(profitCostsContent)
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
    setBusy(true)
    try {
      const costs = await api.profitCosts.save({ methodFees, gatewayFees, codFee })
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
        <>
          {view.methodRatesOn ? (
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
          ) : null}
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
          {view.codOn ? (
            <SettingsCard id="cod-fee" title={copy.cod.heading} description={copy.cod.help}>
              <FeeRateRow
                id="fee-cod"
                label={copy.cod.label}
                value={form.cod}
                disabled={!canManage || busy}
                onChange={(cod) => setForm((f) => (f ? { ...f, cod } : f))}
              />
            </SettingsCard>
          ) : null}
        </>
      )}
    </div>
  )
}
