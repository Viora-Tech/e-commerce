'use client'

import { CircleCheck, Pause } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
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
  /** `page`: the gateway's own page, Shopify style: a red Deactivate at the bottom right, outside the card. */
  placement?: 'card' | 'page'
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
  placement = 'card',
}: GatewayActiveFooterProps) {
  // Hooks
  const { active: copy } = useCopy(paymentModesContent)
  const router = useRouter()
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
      // Redraws the layout's "Test mode" banner.
      router.refresh()
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
    <div
      className={
        placement === 'page'
          ? 'flex flex-wrap items-center justify-end gap-3'
          : 'flex flex-wrap items-center gap-3 border-t border-border pt-4'
      }
    >
      {active ? (
        <Button
          variant={placement === 'page' ? 'destructive' : 'outline'}
          className={placement === 'page' ? undefined : 'text-destructive hover:text-destructive'}
          disabled={busy}
          onClick={handleDeactivate}
        >
          <Pause aria-hidden="true" />
          {copy.deactivate(name)}
        </Button>
      ) : (
        <>
          <Button disabled={busy} onClick={handleActivate}>
            <CircleCheck aria-hidden="true" />
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
