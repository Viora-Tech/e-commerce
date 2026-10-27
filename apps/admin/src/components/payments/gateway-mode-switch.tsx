'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { decideSwitch, keySetStatus, MODE_ORDER } from './mode-switch'
import PaymentModeControl from './payment-mode-control'
import { type GatewayApp, isModeGateway } from './types'

type GatewayModeSwitchProps = {
  gateway: GatewayApp
  onChanged: () => Promise<void> | void
  /** `page`: its own card on the gateway's page. `card`: a block inside a Payments card. */
  placement?: 'page' | 'card'
}

/** A gateway's Connect page, opened on one key set. */
const keysHref = (id: string, mode: PaymentModeId) => `${routes.apps.connect(id)}?keys=${mode}`

const STATUS_TONE = {
  'in-use': 'text-foreground font-medium',
  saved: 'text-muted-foreground',
  missing: 'text-muted-foreground',
} as const

/**
 * Every gateway's Live/Test switch, Stripe/Razorpay-dashboard style: a "Live | Test" control,
 * each key set's state with a link to edit it, a clear refusal when the keys for a mode are
 * missing, and a short confirmation otherwise. Switching only swaps which saved set checkout
 * uses; no key is ever deleted. Turning the gateway off is `GatewayActiveFooter`.
 */
export default function GatewayModeSwitch({
  gateway,
  onChanged,
  placement = 'card',
}: GatewayModeSwitchProps) {
  // Hooks
  const { mode: copy } = useCopy(paymentModesContent)
  const router = useRouter()
  const [pending, setPending] = useState<PaymentModeId | null>(null)
  const [blocked, setBlocked] = useState<PaymentModeId | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handlePick = (to: PaymentModeId) => {
    const decision = decideSwitch(gateway.mode, to, gateway.keys)
    setBlocked(decision.kind === 'blocked' ? decision.missing : null)
    if (decision.kind === 'confirm') setPending(decision.to)
  }

  const handleConfirm = async () => {
    if (!pending || !isModeGateway(gateway.id)) return
    setBusy(true)
    try {
      const r = await api.payments.switchMode({ providerId: gateway.id, mode: pending })
      if (!r.ok) {
        if (r.code === 'no_keys') setBlocked(pending)
        else toast.error(r.message)
        return
      }
      toast.success(copy.switched(pending))
      await onChanged()
      // The admin-wide "Test mode" banner lives in the layout, which navigation never redraws.
      router.refresh()
    } catch {
      toast.error(copy.failed)
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
  const dialogCopy = pending === 'live' ? copy.toLive : copy.toTest

  const body = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PaymentModeControl
          id={gateway.id}
          label={copy.heading}
          value={gateway.mode}
          active={gateway.mode}
          keys={gateway.keys}
          onChange={handlePick}
          disabled={busy}
        />
        <p className="text-caption text-muted-foreground">{copy.help}</p>
      </div>

      {blocked ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning-border bg-warning-soft px-3 py-2"
        >
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-body text-foreground">{copy.blocked(blocked)}</p>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={keysHref(gateway.id, blocked)} />}
          >
            {copy.addKeys(blocked)}
          </Button>
        </div>
      ) : null}

      <dl className="grid gap-2 sm:grid-cols-2">
        {MODE_ORDER.map((mode) => {
          const status = keySetStatus(mode, gateway.mode, gateway.keys)
          return (
            <div
              key={mode}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <dt className="text-caption text-muted-foreground">{copy.keysLabel(mode)}</dt>
                <dd className={cn('text-body', STATUS_TONE[status])}>{copy.status[status]}</dd>
              </div>
              <Button
                variant="link"
                size="sm"
                className="shrink-0 px-0"
                nativeButton={false}
                render={<Link href={keysHref(gateway.id, mode)} />}
              >
                {status === 'missing' ? copy.addKeys(mode) : copy.editKeys(mode)}
              </Button>
            </div>
          )
        })}
      </dl>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={handleDialog}
        title={dialogCopy.title}
        body={dialogCopy.body}
        confirmLabel={dialogCopy.confirm}
        tone="default"
        busy={busy}
        onConfirm={handleConfirm}
      />
    </div>
  )

  if (placement === 'card') return <div className="border-t border-border pt-4">{body}</div>

  return (
    <Card>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
