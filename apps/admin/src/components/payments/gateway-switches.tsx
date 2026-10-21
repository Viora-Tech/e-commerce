'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { type GatewayApp, isModeGateway } from './types'

type GatewaySwitchesProps = {
  gateway: GatewayApp
  onChanged: () => Promise<void> | void
}

type Pending = { to: PaymentModeId } | null

/**
 * A gateway card's Live ⇄ Test switch: which saved key set checkout uses. Flipping never
 * deletes keys and asks first. Turning the gateway off is the card's footer
 * (`GatewayActiveFooter`).
 */
export default function GatewaySwitches({ gateway, onChanged }: GatewaySwitchesProps) {
  // Hooks
  const copy = useCopy(paymentModesContent)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleMode = (next: string[]) => {
    const to = next[0]
    if ((to === 'test' || to === 'live') && to !== gateway.mode) setPending({ to })
  }

  const handleConfirmMode = async () => {
    if (!pending || !isModeGateway(gateway.id)) return
    setBusy(true)
    try {
      const r = await api.payments.switchMode({ providerId: gateway.id, mode: pending.to })
      if (!r.ok) {
        toast.error(r.code === 'no_keys' ? copy.mode.missing(pending.to) : r.message)
        return
      }
      toast.success(copy.mode.switched(pending.to))
      await onChanged()
    } catch {
      toast.error(copy.mode.failed)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const handleDialog = (open: boolean) => {
    if (!open) setPending(null)
  }

  // Early returns
  if (!isModeGateway(gateway.id) || !gateway.configured) return null

  // Render logic
  const missing = gateway.mode === 'live' ? 'test' : 'live'
  const goingLive = pending?.to === 'live'
  const modeCopy = goingLive ? copy.mode.toLive : copy.mode.toTest

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span id={`${gateway.id}-keys-in-use`} className="text-caption text-muted-foreground">
          {copy.mode.label}
        </span>
        <ToggleGroup
          aria-labelledby={`${gateway.id}-keys-in-use`}
          value={gateway.mode ? [gateway.mode] : []}
          onValueChange={handleMode}
          variant="outline"
          size="sm"
          spacing={0}
          disabled={busy}
        >
          <ToggleGroupItem value="test" disabled={!gateway.keys.test}>
            {copy.mode.test}
          </ToggleGroupItem>
          <ToggleGroupItem value="live" disabled={!gateway.keys.live}>
            {copy.mode.live}
          </ToggleGroupItem>
        </ToggleGroup>
        {gateway.keys[missing] ? null : (
          <Button
            variant="link"
            size="sm"
            className="px-0"
            nativeButton={false}
            render={<Link href={`${routes.apps.connect(gateway.id)}?keys=${missing}`} />}
          >
            {copy.mode.addKeys(missing)}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={handleDialog}
        title={modeCopy.title}
        body={modeCopy.body}
        confirmLabel={modeCopy.confirm}
        tone="default"
        busy={busy}
        onConfirm={handleConfirmMode}
      />
    </div>
  )
}
