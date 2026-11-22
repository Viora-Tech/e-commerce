'use client'

import type { CheckoutSettingsView, PaymentAdjustment } from '@commerce/core'
import type { CodRules } from '@commerce/core/checkout-settings'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import CodRulesCard from '@/components/settings/cod-rules-card'
import LoadFailed from '@/components/states/load-failed'
import { checkoutSettingsContent as copy } from '@/data/checkout-settings'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type CodSettingsSectionProps = {
  codOn: boolean
}

type Draft = { cod: CodRules; codFee: PaymentAdjustment | null }

const draftOf = (v: CheckoutSettingsView): Draft => ({ cod: v.settings.cod, codFee: v.codFee })

/**
 * Settings → Payments → Manual: cash on delivery's fee, largest order, blocked PIN codes and the
 * WhatsApp check, the one place for them (#97). They are still stored with the checkout settings,
 * which the checkout reads, so saving sends the rest of those settings back unchanged.
 */
export default function CodSettingsSection({ codOn }: CodSettingsSectionProps) {
  // Hooks
  const [loaded, setLoaded] = useState<CheckoutSettingsView | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [key, setKey] = useState(0)
  const [saving, setSaving] = useState(false)

  const { failed, retry } = useLoad(async () => {
    const v = await api.checkoutSettings.get()
    setLoaded(v)
    setDraft(draftOf(v))
    return v
  })

  // Event handlers
  const handleSave = async () => {
    if (!loaded || !draft) return
    setSaving(true)
    try {
      const next = await api.checkoutSettings.save({
        settings: { ...loaded.settings, cod: draft.cod },
        codFee: draft.codFee,
      })
      setLoaded(next)
      setDraft(draftOf(next))
      toast.success(copy.cod.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!loaded) return
    setDraft(draftOf(loaded))
    setKey((k) => k + 1)
  }

  // Early returns
  if (!codOn) return null
  if (failed && !loaded) return <LoadFailed failed={failed} onRetry={retry} size="inline" />
  if (!loaded || !draft) return <DataCardSkeleton fields={3} />

  // Render logic
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(loaded))

  return (
    <div className="flex flex-col gap-3">
      <CodRulesCard
        key={key}
        codEnabled
        rules={draft.cod}
        fee={draft.codFee}
        onRules={(cod) => setDraft({ ...draft, cod })}
        onFee={(codFee) => setDraft({ ...draft, codFee })}
      />
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={handleDiscard}>
            {copy.cod.discard}
          </Button>
          <Button loading={saving} disabled={saving} onClick={handleSave}>
            {copy.save}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
