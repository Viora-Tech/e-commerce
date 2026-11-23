'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import SettingsCard from '@/components/settings/settings-card'
import LoadFailed from '@/components/states/load-failed'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type GatewayFeeProviderId = 'snapmint' | 'razorpay' | 'cashfree'

type GatewayFeeCardProps = {
  providerId: GatewayFeeProviderId
  /** The app's name in the heading and the default label ("Razorpay convenience fee"). */
  name: string
  /** The label for a fee when none is typed; defaults to "<app> convenience fee". */
  feeLabel?: string | undefined
  /** The help line under the heading; defaults to the general one. */
  intro?: string | undefined
}

const loadAdjustment = (providerId: string) =>
  api.store
    .getPayments()
    .then(
      (r) =>
        (r.settings.adjustments as Record<string, PaymentAdjustment> | undefined)?.[providerId] ??
        null,
    )

/**
 * A payment app's "Extra charge for <app>" card: the fee (or, negative, the discount) shoppers
 * see beside that way to pay and pay on top of the order total. Saved on its own, as
 * `store.payments.adjustments[providerId]`; the checkout and the placed order already apply it.
 */
export default function GatewayFeeCard({ providerId, name, feeLabel, intro }: GatewayFeeCardProps) {
  // Hooks
  const { gatewayFee: copy } = useCopy(paymentsSettingsContent)
  const [draft, setDraft] = useState<PaymentAdjustment | null>(null)
  const [key, setKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const {
    data: saved,
    failed,
    loading,
    retry,
    setData,
  } = useLoad(async () => {
    const adjustment = await loadAdjustment(providerId)
    setDraft(adjustment)
    return { adjustment }
  }, [providerId])

  // Helpers
  const labelFor = (discount: boolean) =>
    !discount && feeLabel ? feeLabel : copy.defaultLabel(name, discount)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      // An empty label is saved as the default, so the order summary names the charge.
      const adjustment = draft
        ? { ...draft, label: draft.label?.trim() || labelFor(draft.value < 0) }
        : null
      const next = await api.payments.saveAdjustment({ providerId, adjustment })
      setData({ adjustment: next.adjustment })
      setDraft(next.adjustment)
      setKey((k) => k + 1)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(errorText(err, copy.saveFailed))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraft(saved?.adjustment ?? null)
    setKey((k) => k + 1)
  }

  // Early returns
  if (failed && !saved) return <LoadFailed failed={failed} onRetry={retry} size="inline" />
  if (loading && !saved) return <DataCardSkeleton fields={2} />

  // Render logic
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.adjustment ?? null)
  const placeholder = labelFor((draft?.value ?? 0) < 0)

  return (
    <SettingsCard
      id={`${providerId}-fee`}
      title={copy.heading(name)}
      description={intro ?? copy.intro}
      footer={
        dirty ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={saving} onClick={handleDiscard}>
              {copy.discard}
            </Button>
            <Button loading={saving} disabled={saving} onClick={handleSave}>
              {copy.save}
            </Button>
          </div>
        ) : undefined
      }
    >
      <PaymentAdjustmentFields
        key={key}
        providerId={providerId}
        value={draft ?? undefined}
        onChange={(next) => setDraft(next ?? null)}
        labelPlaceholder={placeholder}
      />
    </SettingsCard>
  )
}
