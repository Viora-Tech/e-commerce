'use client'

import { permissions } from '@commerce/core/permissions'
import type { FeeRate, ProfitCostSettings } from '@commerce/core/profit'
import { parseRupees } from '@commerce/money'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import { profitCostsContent } from '@/data/profit-costs'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import FeeRateRow, { type FeeRateText } from './fee-rate-row'

type View = Awaited<ReturnType<typeof api.profitCosts.get>>
type Form = { gateways: Record<string, FeeRateText>; cod: FeeRateText }

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

const formOf = (view: View): Form => ({
  gateways: Object.fromEntries(view.gateways.map((id) => [id, toText(view.costs.gatewayFees[id])])),
  cod: toText(view.costs.codFee),
})

/** Settings › Costs for profit: each gateway's fee and the courier's cash on delivery fee. */
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
      : (copy.methodNames[id] ?? `${id.charAt(0).toUpperCase()}${id.slice(1)}`)

  // Event handlers
  const handleSave = async () => {
    if (!view || !form) return
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
      const costs = await api.profitCosts.save({ gatewayFees, codFee })
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

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const dirty = !!view && !!form && JSON.stringify(form) !== JSON.stringify(formOf(view))

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
      <SettingsPageHeader
        title={copy.title}
        subtitle={copy.intro}
        onSave={handleSave}
        dirty={dirty}
        saving={busy}
        saveLabel={copy.save}
      />
      {!view || !form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
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
          </SettingsCard>
          {view.codOn ? (
            <SettingsCard title={copy.cod.heading} description={copy.cod.help}>
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
