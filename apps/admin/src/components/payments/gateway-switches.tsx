'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { GatewayApp } from './types'

type GatewaySwitchesProps = {
  gateway: GatewayApp
  /** The only online gateway on at checkout: turning it off leaves COD / bank transfer only. */
  onlyOnline: boolean
  onChanged: () => Promise<void> | void
}

type Pending = { kind: 'mode'; to: PaymentModeId } | { kind: 'off' } | null

const MODE_GATEWAYS = ['razorpay', 'cashfree', 'decentro'] as const
type ModeGatewayId = (typeof MODE_GATEWAYS)[number]

const isModeGateway = (id: string): id is ModeGatewayId =>
  (MODE_GATEWAYS as readonly string[]).includes(id)

/**
 * A gateway card's two switches: Live ⇄ Test (which saved key set checkout
 * uses; flipping never deletes keys) and Active/Inactive (off leaves checkout
 * at once, keys kept). Both ask first.
 */
export default function GatewaySwitches({ gateway, onlyOnline, onChanged }: GatewaySwitchesProps) {
  // Hooks
  const copy = useCopy(paymentModesContent)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const setActive = async (active: boolean) => {
    if (!isModeGateway(gateway.id)) return
    setBusy(true)
    try {
      const r = await api.payments.setActive({ providerId: gateway.id, active })
      if (!r.ok) {
        toast.error(r.message ?? copy.active.failed)
        return
      }
      toast.success(active ? copy.active.turnedOn : copy.active.turnedOff)
      await onChanged()
    } catch {
      toast.error(copy.active.failed)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  // Event handlers
  const handleMode = (next: string[]) => {
    const to = next[0]
    if ((to === 'test' || to === 'live') && to !== gateway.mode) setPending({ kind: 'mode', to })
  }

  const handleActive = (on: boolean) => {
    if (on) void setActive(true)
    else setPending({ kind: 'off' })
  }

  const handleConfirmMode = async () => {
    if (pending?.kind !== 'mode' || !isModeGateway(gateway.id)) return
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

  const handleConfirmOff = () => setActive(false)

  const handleDialog = (open: boolean) => {
    if (!open) setPending(null)
  }

  // Early returns
  if (!isModeGateway(gateway.id) || !gateway.configured) return null

  // Render logic
  const active = gateway.connected
  const missing = gateway.mode === 'live' ? 'test' : 'live'
  const goingLive = pending?.kind === 'mode' && pending.to === 'live'
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
      <label className="flex items-center gap-2 text-caption text-muted-foreground">
        <Switch checked={active} onCheckedChange={handleActive} disabled={busy} />
        {active ? copy.active.on : copy.active.off}
      </label>

      <ConfirmDialog
        open={pending?.kind === 'mode'}
        onOpenChange={handleDialog}
        title={modeCopy.title}
        body={modeCopy.body}
        confirmLabel={modeCopy.confirm}
        tone="default"
        busy={busy}
        onConfirm={handleConfirmMode}
      />
      <ConfirmDialog
        open={pending?.kind === 'off'}
        onOpenChange={handleDialog}
        title={copy.active.offTitle}
        body={onlyOnline ? `${copy.active.offBody} ${copy.active.onlyOnline}` : copy.active.offBody}
        confirmLabel={copy.active.confirmOff}
        busy={busy}
        onConfirm={handleConfirmOff}
      />
    </div>
  )
}
