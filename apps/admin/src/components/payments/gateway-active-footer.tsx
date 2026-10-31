'use client'

import { CircleCheck, Pause } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { type GatewayApp, isModeGateway } from './types'
import { useGatewayActive } from './use-gateway-active'

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
  const { asking, setAsking, busy, deactivate, activate, confirmOff } = useGatewayActive(
    gateway,
    onChanged,
  )

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
          onClick={deactivate}
        >
          <Pause aria-hidden="true" />
          {copy.deactivate(name)}
        </Button>
      ) : (
        <>
          <Button disabled={busy} onClick={activate}>
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
        onConfirm={confirmOff}
      />
    </div>
  )
}
