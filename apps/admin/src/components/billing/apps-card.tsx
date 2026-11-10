'use client'

import type { AppBill } from '@commerce/core'
import type { AppAccess } from '@commerce/core/billing'
import { CreditCard } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
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

/** Plan & billing → Paid apps: what was bought on top of the plan, its bill, and Stop renewing. */
export default function AppsCard({ apps }: AppsCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const router = useRouter()
  const [stopping, setStopping] = useState<BoughtApp | null>(null)
  const [busy, setBusy] = useState(false)

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
    <DataCard title={copy.apps.heading} subtitle={copy.apps.help}>
      <ul className="flex flex-col divide-y divide-border">
        {apps.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex flex-col">
              <span className="text-body font-medium text-ink-strong">{a.name}</span>
              <span className="text-caption text-muted-foreground">
                {[
                  a.status?.state === 'included'
                    ? copy.apps.included(copy.plans[a.status.plan].name)
                    : null,
                  a.status?.state === 'buy'
                    ? `${copy.apps.buyFor(format.money(a.status.pricePaise))} · ${copy.apps.orIncluded(copy.plans[a.status.includedFrom].name)}`
                    : null,
                  a.access
                    ? a.access.renews
                      ? copy.apps.paidUntil(format.date(a.access.until))
                      : copy.apps.endsOn(format.date(a.access.until))
                    : null,
                  a.due ? copy.apps.due(format.money(a.due.amountPaise)) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <div className="flex gap-2">
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
              {a.status?.state === 'buy' ? (
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
                <Button size="sm" variant="outline" onClick={() => setStopping(a)}>
                  {copy.apps.stop}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
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
