'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type GatewayApp, isModeGateway } from './types'

type GatewayActiveFooterProps = {
  gateway: GatewayApp
  /** Shown as "Deactivate Razorpay". */
  name: string
  /** The only online gateway on at checkout: turning it off leaves COD / bank transfer only. */
  onlyOnline: boolean
  onChanged: () => Promise<void> | void
}

/**
 * The card's bottom row, Shopify style: "Deactivate <gateway>" on the left (asks first; keys
 * stay saved), or "Activate <gateway>" when it is off.
 */
export default function GatewayActiveFooter({
  gateway,
  name,
  onlyOnline,
  onChanged,
}: GatewayActiveFooterProps) {
  // Hooks
  const { active: copy } = useCopy(paymentModesContent)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const setActive = async (active: boolean) => {
    if (!isModeGateway(gateway.id)) return
    setBusy(true)
    try {
      const r = await api.payments.setActive({ providerId: gateway.id, active })
      if (!r.ok) {
        toast.error(r.message ?? copy.failed)
        return
      }
      toast.success(active ? copy.turnedOn : copy.turnedOff)
      await onChanged()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  // Event handlers
  const handleDeactivate = () => setAsking(true)

  const handleActivate = () => setActive(true)

  const handleConfirmOff = () => setActive(false)

  // Early returns
  if (!isModeGateway(gateway.id) || !gateway.configured) return null

  // Render logic
  const active = gateway.connected

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      {active ? (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={handleDeactivate}
        >
          {copy.deactivate(name)}
        </Button>
      ) : (
        <>
          <Button disabled={busy} onClick={handleActivate}>
            {copy.activate(name)}
          </Button>
          <p className="text-caption text-muted-foreground">{copy.inactiveHelp}</p>
        </>
      )}

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.offTitle}
        body={onlyOnline ? `${copy.offBody} ${copy.onlyOnline}` : copy.offBody}
        confirmLabel={copy.confirmOff}
        busy={busy}
        onConfirm={handleConfirmOff}
      />
    </div>
  )
}
