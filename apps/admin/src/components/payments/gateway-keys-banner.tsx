'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { gatewayKeysContent } from '@/data/gateway-keys'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type GatewayAlert = Awaited<ReturnType<typeof api.payments.gatewayAlerts>>[number]

type GatewayKeysBannerProps = {
  /** Classes for the wrapper, so each page can place it in its own column. */
  className?: string | undefined
}

/**
 * "Razorpay rejected your API keys — re-enter them": shown on Home and Settings → Payments while
 * a gateway refused the store's keys and checkout hides it. Nothing shows when all is well.
 */
export default function GatewayKeysBanner({ className }: GatewayKeysBannerProps) {
  // Hooks
  const { banner: copy } = useCopy(gatewayKeysContent)
  const fmt = useFormat()
  const [alerts, setAlerts] = useState<GatewayAlert[]>([])

  useEffect(() => {
    // A member who cannot read settings, or an older API: no banner, nothing else breaks.
    api.payments
      .gatewayAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]))
  }, [])

  // Early returns
  if (alerts.length === 0) return null

  // Render logic
  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      {alerts.map((a) => (
        <Alert key={a.gateway} variant="destructive" className="rounded-xl p-4">
          <CircleAlert />
          <AlertTitle>{copy.title(a.name)}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>{copy.body(a.name)}</span>
            {a.lastError ? <span>{copy.said(a.name, a.lastError)}</span> : null}
            <span>{copy.since(fmt.when(a.since))}</span>
            <Link
              href={routes.apps.connect(a.gateway)}
              className="w-fit font-medium underline underline-offset-2"
            >
              {copy.action}
            </Link>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
