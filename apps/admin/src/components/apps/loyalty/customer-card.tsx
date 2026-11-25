'use client'

import { permissions } from '@commerce/core/permissions'
import { dayStart } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import HistoryPager from '@/components/layout/history-pager'
import InlineState from '@/components/states/inline-state'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatDay, formatPattern } from '@/lib/format-date'
import { HISTORY_PAGE, historyLimit, historyPage, nextShown } from '@/lib/history-page'
import { pointsEntryKind } from '@/lib/loyalty-entry'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import { announceStoreCreditChanged, STORE_CREDIT_CHANGED_EVENT } from '@/lib/store-credit-events'
import AdjustDialog from './adjust-dialog'
import BirthdayDialog from './birthday-dialog'

type LoyaltyCustomerCardProps = { customerId: string }

type Points = Awaited<ReturnType<typeof api.loyalty.forCustomer>>

/** ₹ per point. */
const POINT_PAISE = 100

/**
 * The customer page's Loyalty points card: points (₹1 each, part of the store credit balance),
 * what runs out soon and what is on the way, the birthday, Adjust points, and the history.
 */
export default function LoyaltyCustomerCard({ customerId }: LoyaltyCustomerCardProps) {
  // Hooks
  const copy = useCopy(loyaltyContent)
  const locale = useLocale()
  const { hasPermission } = usePermissions()
  const [shown, setShown] = useState(HISTORY_PAGE)
  const { data, failed, loading, retry } = useLoad<Points>(
    () => api.loyalty.forCustomer({ customerId, limit: historyLimit(shown) }),
    [customerId, shown],
  )
  const [dialog, setDialog] = useState<'adjust' | 'birthday' | null>(null)

  // Effects
  // The other card (points are store credit) changed the balance: read it again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry only bumps a state counter
  useEffect(() => {
    window.addEventListener(STORE_CREDIT_CHANGED_EVENT, retry)
    return () => window.removeEventListener(STORE_CREDIT_CHANGED_EVENT, retry)
  }, [])

  // Helpers
  const day = (key: string) =>
    formatPattern(dayStart(key), { day: 'numeric', month: 'short', year: 'numeric' }, locale)
  const birthdayLabel = (mmdd: string) => {
    const [m, d] = mmdd.split('-').map(Number) as [number, number]
    return `${d} ${copy.months[m - 1] ?? ''}`
  }

  // Event handlers
  const handleDone = () => {
    setDialog(null)
    // Both cards (this one and Store credit) read the balance again.
    announceStoreCreditChanged()
  }

  // Render logic
  const c = copy.card
  const canEdit = hasPermission(permissions.CUSTOMERS_WRITE)
  const { visible, hasMore } = historyPage(data?.entries ?? [], shown)

  return (
    <DataCard
      title={c.heading}
      action={
        canEdit && data ? (
          <Button size="sm" variant="outline" onClick={() => setDialog('adjust')}>
            {c.adjust}
          </Button>
        ) : null
      }
    >
      {failed ? (
        failed === 'no-access' ? (
          <InlineState kind="no-access" />
        ) : (
          <InlineState kind="error" heading={c.loadFailed} onRetry={retry} />
        )
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption text-muted-foreground">{c.balance}</span>
            <span className="text-card-title tabular-nums text-ink-strong">
              {copy.points(data.points)}
            </span>
          </div>
          <span className="text-caption text-muted-foreground">
            {c.worth(formatPaise(data.points * POINT_PAISE, locale))}
          </span>
          {data.expiringSoon ? (
            <span className="text-caption text-warning">
              {c.expiring(copy.points(data.expiringSoon.points), day(data.expiringSoon.lastDay))}
            </span>
          ) : null}
          {data.pendingPoints > 0 ? (
            <span className="text-caption text-muted-foreground">
              {c.pending(copy.points(data.pendingPoints))}
            </span>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-caption text-muted-foreground">{c.birthday}</span>
            <span className="flex items-center gap-2 text-body">
              {data.birthday ? birthdayLabel(data.birthday) : c.noBirthday}
              {canEdit ? (
                <Button size="sm" variant="ghost" onClick={() => setDialog('birthday')}>
                  {c.editBirthday}
                </Button>
              ) : null}
            </span>
          </div>
          {data.entries.length === 0 ? (
            <EmptyState variant="inline" body={c.empty} />
          ) : (
            <ul aria-label={c.history} className="flex flex-col divide-y divide-line">
              {visible.map((e) => (
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
                      {pointsEntryKind(e, copy)} · {formatDay(e.createdAt, new Date(), locale)}
                      {e.staffEmail ? ` ${c.by(e.staffEmail)}` : ''}
                    </span>
                    {e.status === 'pending' ? (
                      <span className="block text-caption text-muted-foreground">
                        {c.lands(formatDay(e.availableAt, new Date(), locale))}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${e.status === 'cancelled' ? 'text-muted-foreground line-through' : e.points > 0 ? 'text-success' : 'text-foreground'}`}
                  >
                    {e.points > 0 ? '+' : '−'}
                    {Math.abs(e.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <HistoryPager
            hasMore={hasMore}
            expanded={shown > HISTORY_PAGE}
            loading={loading}
            moreLabel={c.more}
            lessLabel={c.less}
            onMore={() => setShown(nextShown)}
            onLess={() => setShown(HISTORY_PAGE)}
          />
        </div>
      )}
      <AdjustDialog
        customerId={customerId}
        open={dialog === 'adjust'}
        points={data?.points ?? 0}
        onClose={() => setDialog(null)}
        onDone={handleDone}
      />
      {dialog === 'birthday' ? (
        <BirthdayDialog
          customerId={customerId}
          open
          birthday={data?.birthday ?? null}
          onClose={() => setDialog(null)}
          onDone={handleDone}
        />
      ) : null}
    </DataCard>
  )
}
