'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { PaymentProblem } from './types'

type GatewayProblemProps = {
  problem: PaymentProblem
  gatewayId: string
  onFixed: () => void
  onTurnOnUpi: () => void
}

/** One health problem: a red dot, a plain sentence, and the one-click fix when there is one. */
export default function GatewayProblem({
  problem,
  gatewayId,
  onFixed,
  onTurnOnUpi,
}: GatewayProblemProps) {
  // Hooks
  const { problems: copy } = useCopy(paymentsSetupContent)
  const [fixing, setFixing] = useState(false)

  // Event handlers
  const handleFixWebhook = async () => {
    setFixing(true)
    try {
      const r = await api.payments.fixWebhook()
      if (r.ok) {
        toast.success(r.message)
        onFixed()
      } else {
        toast.error(r.message)
      }
    } finally {
      setFixing(false)
    }
  }

  // Render logic
  const connectHref = `/apps/${gatewayId}/connect`
  const action =
    problem.code === 'webhook_silent' && problem.fix === 'reregister' ? (
      <Button size="sm" onClick={handleFixWebhook} disabled={fixing}>
        {fixing ? <Spinner /> : null}
        {fixing ? copy.fixing : copy.fix}
      </Button>
    ) : problem.code === 'webhook_silent' ? (
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={connectHref} />}>
        {copy.showHow}
      </Button>
    ) : problem.code === 'reconnect' ? (
      <Button size="sm" nativeButton={false} render={<Link href={connectHref} />}>
        {copy.reconnectAction}
      </Button>
    ) : problem.code === 'config_invalid' ? (
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={connectHref} />}>
        {copy.openConnect}
      </Button>
    ) : (
      <Button size="sm" onClick={onTurnOnUpi}>
        {copy.turnOnUpi}
      </Button>
    )

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center">
      <span className="flex flex-1 items-start gap-2 text-body text-foreground">
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" />
        {copy[problem.code]}
      </span>
      {action}
    </li>
  )
}
