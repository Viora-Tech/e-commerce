'use client'

import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { customerStoreCreditContent } from '@/data/customer-store-credit'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
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
  const [account, setAccount] = useState<Account | null>(null)
  const [failed, setFailed] = useState(false)
  const [mode, setMode] = useState<'add' | 'remove' | null>(null)

  useEffect(() => {
    let live = true
    setFailed(false)
    api.storeCredit
      .get({ customerId })
      .then((a) => {
        if (live) setAccount(a)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [customerId])

  // Helpers
  const money = (paise: number) => formatPaise(paise, locale)

  // Event handlers
  const handleDone = () => {
    setMode(null)
    api.storeCredit
      .get({ customerId })
      .then(setAccount)
      .catch(() => setFailed(true))
  }

  // Render logic
  const canEdit = hasPermission(permissions.CUSTOMERS_WRITE)
  const balance = account?.balancePaise ?? 0

  return (
    <DataCard
      title={copy.heading}
      className="rounded-xl"
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
        <p className="text-caption text-muted-foreground">{copy.loadFailed}</p>
      ) : !account ? null : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption text-muted-foreground">{copy.balance}</span>
            <span className="text-card-title tabular-nums text-ink-strong">{money(balance)}</span>
          </div>
          {account.entries.length === 0 ? (
            <p className="text-caption text-muted-foreground">{copy.empty}</p>
          ) : (
            <ul aria-label={copy.history} className="flex flex-col divide-y divide-line">
              {account.entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-foreground">{e.reason}</span>
                    <span className="block text-caption text-muted-foreground">
                      {copy.kinds[e.kind] ?? e.kind} · {formatDay(e.createdAt, new Date(), locale)}{' '}
                      {e.staffEmail ? copy.by(e.staffEmail) : copy.system}
                    </span>
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
