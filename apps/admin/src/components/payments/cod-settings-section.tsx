'use client'

import type { CheckoutSettingsView, PaymentAdjustment } from '@commerce/core'
import type { CodRules } from '@commerce/core/checkout-settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import CodRulesCard from '@/components/settings/cod-rules-card'
import { checkoutSettingsContent as copy } from '@/data/checkout-settings'
import { api } from '@/lib/api-client'

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

  useEffect(() => {
    api.checkoutSettings.get().then((v) => {
      setLoaded(v)
      setDraft(draftOf(v))
    })
  }, [])

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
      toast.error(err instanceof Error ? err.message : copy.failed)
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
  if (!loaded || !draft) return <Skeleton className="h-64 w-full rounded-2xl" />

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
          <Button disabled={saving} onClick={handleSave}>
            {saving ? <Spinner /> : null}
            {copy.save}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
