'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
 * The gateway's "Test mode" card, Shopify style: one switch for which saved key set checkout uses. Flipping never
 * deletes keys and asks first. Turning the gateway off is the card's footer
 * (`GatewayActiveFooter`).
 */
export default function GatewaySwitches({ gateway, onChanged }: GatewaySwitchesProps) {
  // Hooks
  const copy = useCopy(paymentModesContent)
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleTestMode = (on: boolean) => {
    const to = on ? 'test' : 'live'
    if (to !== gateway.mode) setPending({ to })
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
      // The admin-wide "Test mode" banner lives in the layout, which navigation never redraws.
      router.refresh()
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
    <section aria-labelledby={`${gateway.id}-test-mode`} className="flex flex-col gap-3">
      <h2 id={`${gateway.id}-test-mode`} className="text-body font-semibold text-foreground">
        {copy.mode.testHeading}
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <Label className="flex items-center justify-between gap-4 text-body font-normal text-ink-strong">
            {copy.mode.testHelp}
            <Switch
              checked={gateway.mode === 'test'}
              onCheckedChange={handleTestMode}
              disabled={busy || !gateway.keys[missing]}
            />
          </Label>
          {gateway.keys[missing] ? null : (
            <Button
              variant="link"
              size="sm"
              className="w-fit px-0"
              nativeButton={false}
              render={<Link href={`${routes.apps.connect(gateway.id)}?keys=${missing}`} />}
            >
              {copy.mode.addKeys(missing)}
            </Button>
          )}
        </CardContent>
      </Card>

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
    </section>
  )
}
