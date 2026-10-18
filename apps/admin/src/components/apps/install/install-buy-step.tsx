'use client'

import type { AppAccess } from '@commerce/core/billing'
import { Button } from '@commerce/ui/shadcn/button'
import { DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { appInstallContent } from '@/data/app-install'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type BuyAccess = Extract<AppAccess, { state: 'buy' }>

type InstallBuyStepProps = {
  appId: string
  appName: string
  access: BuyAccess
  onCancel: () => void
}

const PLAN_NAMES = { starter: 'Starter', growth: 'Growth', pro: 'Pro' } as const

/**
 * A paid app the plan does not include: its monthly price, then the pay link. Paying installs
 * it (the sales store's order.paid hook), so the flow ends here.
 */
export default function InstallBuyStep({ appId, appName, access, onCancel }: InstallBuyStepProps) {
  // Hooks
  const copy = useCopy(appInstallContent)
  const format = useFormat()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleBuy = async () => {
    setBusy(true)
    try {
      const bill = await api.billing.buyApp({ pluginId: appId })
      if (bill.url) window.location.assign(bill.url)
      else toast.error(copy.buy.failed)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.buy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const price = format.money(access.pricePaise)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <DialogTitle>{copy.buy.title(appName)}</DialogTitle>
        <DialogDescription>
          {copy.buy.intro(appName, PLAN_NAMES[access.includedFrom])}
        </DialogDescription>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4">
        <span className="text-section-title text-ink-strong tabular-nums">
          {copy.buy.price(price)}
        </span>
        <span className="text-caption text-muted-foreground">{copy.buy.renew}</span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {copy.buy.cancel}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.settings.billing()} />}
        >
          {copy.buy.plans}
        </Button>
        <Button onClick={handleBuy} loading={busy}>
          {copy.buy.pay(price)}
        </Button>
      </div>
    </div>
  )
}
