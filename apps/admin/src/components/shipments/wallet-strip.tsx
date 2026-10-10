'use client'

import { CreditCard, ExternalLink } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { shipmentsContent } from '@/data/shipments'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Wallet = Awaited<ReturnType<typeof api.shipments.wallets>>[number]

type WalletStripProps = {
  /** Couriers that report their balance over the API; the others are left out. */
  wallets: Wallet[]
}

/**
 * Figma "Orders / Shipments" wallet strip: one line per courier that shares its balance
 * (Shiprocket does, Delhivery has no balance API, so it gets no strip), with the balance, the
 * low-balance line and Recharge on the courier's own dashboard.
 */
export default function WalletStrip({ wallets }: WalletStripProps) {
  // Hooks
  const copy = useCopy(shipmentsContent.wallet)
  const format = useFormat()

  // Early returns
  if (wallets.length === 0) return null

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {wallets.map((w) => {
        const rechargeUrl = copy.rechargeUrl[w.provider]
        const threshold = format.money(w.lowBalanceThresholdPaise)
        return (
          <section
            key={w.provider}
            className={cn(
              'flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-xs',
              w.low ? 'border-warning/40' : 'border-border',
            )}
          >
            <CreditCard
              aria-hidden
              className={cn('size-5 shrink-0', w.low ? 'text-warning' : 'text-primary')}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-body font-semibold text-ink-strong">
                {copy.heading(w.providerLabel, format.money(w.balancePaise))}
              </h2>
              <p className="text-caption text-muted-foreground">
                {w.low ? copy.low(threshold) : copy.ok(threshold)}
              </p>
            </div>
            {rechargeUrl ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={rechargeUrl} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink aria-hidden />
                {copy.recharge}
              </Button>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
