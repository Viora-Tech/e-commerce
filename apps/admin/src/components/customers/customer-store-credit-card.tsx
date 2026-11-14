'use client'

import { permissions } from '@commerce/core/permissions'
import { dayStart } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import InlineState from '@/components/states/inline-state'
import { customerStoreCreditContent } from '@/data/customer-store-credit'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatDay, formatPattern } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import StoreCreditDialog from './store-credit-dialog'

type CustomerStoreCreditCardProps = { customerId: string }

type Account = Awaited<ReturnType<typeof api.storeCredit.get>>

/**
 * The customer's store credit: the balance, Add and Remove (amount and reason), and the history
 * of every change with why, who and when. Store credit is a balance on the customer, not a code.
 */
export default function CustomerStoreCreditCard({ customerId }: CustomerStoreCreditCardProps) {
  // Hooks
  const copy = useCopy(customerStoreCreditContent)
  const locale = useLocale()
  const { hasPermission } = usePermissions()
  const {
    data: account,
    failed,
    retry,
  } = useLoad<Account>(() => api.storeCredit.get({ customerId }), [customerId])
  const [mode, setMode] = useState<'add' | 'remove' | null>(null)

  // Helpers
  const money = (paise: number) => formatPaise(paise, locale)
  const lastDay = (day: string) =>
    formatPattern(dayStart(day), { day: 'numeric', month: 'short', year: 'numeric' }, locale)

  // Event handlers
  const handleDone = () => {
    setMode(null)
    // Read the balance again; the old one stays on screen until the new one arrives.
    retry()
  }

  // Render logic
  const canEdit = hasPermission(permissions.CUSTOMERS_WRITE)
  const balance = account?.balancePaise ?? 0

  return (
    <DataCard
      title={copy.heading}
      action={
        canEdit && account ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setMode('add')}>
              {copy.add}
            </Button>
            {balance > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setMode('remove')}>
                {copy.remove}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {failed ? (
        failed === 'no-access' ? (
          <InlineState kind="no-access" />
        ) : (
          <InlineState kind="error" heading={copy.loadFailed} onRetry={retry} />
        )
      ) : !account ? (
        // The balance row and two history lines, so the card does not grow when it fills in.
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption text-muted-foreground">{copy.balance}</span>
            <span className="text-card-title tabular-nums text-ink-strong">{money(balance)}</span>
          </div>
          {account.entries.length === 0 ? (
            <EmptyState variant="inline" body={copy.empty} />
          ) : (
            <ul aria-label={copy.history} className="flex flex-col divide-y divide-line">
              {account.entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {e.orderId ? (
                      <Link
                        href={routes.orders.detail(e.orderId)}
                        className="block truncate text-body text-foreground underline-offset-4 hover:underline"
                      >
                        {e.reason}
                      </Link>
                    ) : (
                      <span className="block truncate text-body text-foreground">{e.reason}</span>
                    )}
                    <span className="block text-caption text-muted-foreground">
                      {copy.kinds[e.kind] ?? e.kind} · {formatDay(e.createdAt, new Date(), locale)}{' '}
                      {e.staffEmail ? copy.by(e.staffEmail) : copy.system}
                    </span>
                    {e.expiresOn ? (
                      <span className="block text-caption text-muted-foreground">
                        {copy.expires(lastDay(e.expiresOn))}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      e.amountPaise > 0
                        ? 'shrink-0 tabular-nums text-success'
                        : 'shrink-0 tabular-nums text-foreground'
                    }
                  >
                    {e.amountPaise > 0 ? '+' : '−'}
                    {money(Math.abs(e.amountPaise))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <StoreCreditDialog
        customerId={customerId}
        mode={mode}
        balancePaise={balance}
        onClose={() => setMode(null)}
        onDone={handleDone}
      />
    </DataCard>
  )
}
