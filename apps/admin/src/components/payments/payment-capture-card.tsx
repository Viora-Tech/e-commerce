'use client'

import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { paymentRulesContent } from '@/data/payment-rules'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { isGatewayId, type PaymentsSetup } from './types'

type PaymentCaptureCardProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
}

/**
 * "Payment capture" (#150): per connected gateway, take the money at checkout (automatic) or
 * only authorise it and capture from the order page (manual). Gateways that cannot capture by
 * hand show the choice greyed out with why.
 */
export default function PaymentCaptureCard({ setup, onReload }: PaymentCaptureCardProps) {
  // Hooks
  const { capture: copy } = useCopy(paymentRulesContent)
  const [busy, setBusy] = useState<string | null>(null)

  // Event handlers
  const handleChange = async (gatewayId: string, mode: string) => {
    if (!isGatewayId(gatewayId)) return
    setBusy(gatewayId)
    try {
      await api.payments.saveCapture({
        gatewayId,
        mode: mode === 'manual' ? 'manual' : 'automatic',
      })
      toast.success(copy.saved)
      await onReload()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  const rows = setup.gateways.filter((g) => g.configured && isGatewayId(g.id))
  if (rows.length === 0) return null

  // Render logic
  const anyManual = rows.some((g) => setup.capture[g.id]?.mode === 'manual')

  return (
    <SettingsCard title={copy.heading} description={copy.description}>
      {rows.map((g) => {
        const state = setup.capture[g.id]
        return (
          <SettingsRow
            key={g.id}
            label={g.name}
            description={state?.manualSupported ? undefined : copy.unavailable}
            htmlFor={`capture-${g.id}`}
          >
            <NativeSelect
              id={`capture-${g.id}`}
              aria-label={copy.label(g.name)}
              className="max-w-48"
              value={state?.mode ?? 'automatic'}
              disabled={busy !== null || !state?.manualSupported}
              onChange={(e) => handleChange(g.id, e.target.value)}
            >
              <NativeSelectOption value="automatic">{copy.automatic}</NativeSelectOption>
              <NativeSelectOption value="manual" disabled={!state?.manualSupported}>
                {copy.manual}
              </NativeSelectOption>
            </NativeSelect>
          </SettingsRow>
        )
      })}
      {anyManual ? <p className="text-caption text-muted-foreground">{copy.manualNote}</p> : null}
    </SettingsCard>
  )
}
