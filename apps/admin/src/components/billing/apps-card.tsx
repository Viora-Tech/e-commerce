'use client'

import type { AppBill } from '@commerce/core'
import { APP_PRICING, type AppAccess } from '@commerce/core/billing'
import { CreditCard } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

export type BoughtApp = {
  id: string
  name: string
  access: Extract<AppAccess, { state: 'bought' }> | null
  /** Included, bought or to buy; absent on older callers (treated as bought). */
  status?: AppAccess | undefined
  due: AppBill | null
}

type AppsCardProps = { apps: BoughtApp[] }

/** A paid app's monthly price before GST. */
const priceOf = (id: string): number => APP_PRICING[id]?.pricePaise ?? 0

/**
 * Figma 931:9997 "Apps and your plan": each app that costs extra below a plan, whether the plan
 * includes it, it was bought, or it can be bought, with Pay, Buy and Stop renewing.
 */
export default function AppsCard({ apps }: AppsCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const router = useRouter()
  const [stopping, setStopping] = useState<BoughtApp | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const includedName = (id: string) => {
    const price = APP_PRICING[id]
    return price ? copy.plans[price.includedFrom].name : ''
  }

  // Event handlers
  const handleStop = async () => {
    if (!stopping) return
    setBusy(true)
    try {
      await api.billing.stopApp({ pluginId: stopping.id })
      toast.success(copy.apps.stopped(stopping.name))
      setStopping(null)
      router.refresh()
    } catch {
      toast.error(copy.apps.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!apps.length) return null

  // Render logic
  return (
    <DataCard title={copy.apps.heading} subtitle={copy.apps.help(apps.length)} flush>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {apps.map((a) => {
          const s = a.status
          const sub =
            s?.state === 'buy'
              ? copy.apps.orIncluded(copy.plans[s.includedFrom].name)
              : a.access?.renews && s?.state === 'bought'
                ? copy.apps.renewsIncluded(format.date(a.access.until), includedName(a.id))
                : a.access
                  ? copy.apps.endsOn(format.date(a.access.until))
                  : a.due
                    ? copy.apps.due(format.money(a.due.amountPaise))
                    : null
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex flex-col">
                <span className="text-body text-ink-strong">{a.name}</span>
                {sub ? <span className="text-caption text-muted-foreground">{sub}</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s?.state === 'included' ? (
                  <StatusChip tone="success" variant="outline">
                    {copy.apps.included(copy.plans[s.plan].name)}
                  </StatusChip>
                ) : null}
                {a.access ? (
                  <StatusChip tone="info" variant="outline">
                    {copy.apps.bought(format.money(priceOf(a.id)))}
                  </StatusChip>
                ) : null}
                {s?.state === 'buy' ? (
                  <StatusChip tone="neutral" variant="outline">
                    {copy.apps.buyFor(format.money(s.pricePaise))}
                  </StatusChip>
                ) : null}
                {a.due?.url ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<a href={a.due.url} target="_blank" rel="noopener noreferrer" />}
                  >
                    <CreditCard aria-hidden="true" />
                    {copy.apps.pay}
                  </Button>
                ) : null}
                {s?.state === 'buy' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={routes.apps.page(a.id)} />}
                  >
                    {copy.apps.buy}
                  </Button>
                ) : null}
                {a.access?.renews || a.due ? (
                  <Button size="sm" variant="ghost" onClick={() => setStopping(a)}>
                    {copy.apps.stop}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={stopping !== null}
        onOpenChange={(open) => (open ? null : setStopping(null))}
        title={stopping ? copy.apps.stopTitle(stopping.name) : ''}
        body={
          stopping
            ? copy.apps.stopBody(
                stopping.name,
                stopping.access ? format.date(stopping.access.until) : '',
              )
            : undefined
        }
        confirmLabel={copy.apps.stop}
        cancelLabel={copy.apps.keep}
        tone="destructive"
        busy={busy}
        onConfirm={handleStop}
      />
    </DataCard>
  )
}
