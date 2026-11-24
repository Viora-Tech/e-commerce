'use client'

import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyCustomerContent } from '@/data/loyalty-customer'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatDay } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { announceStoreCreditChanged, STORE_CREDIT_CHANGED_EVENT } from '@/lib/store-credit-events'

type CustomerLoyaltyExtrasProps = { customerId: string }

type Details = Awaited<ReturnType<typeof api.loyalty.customer>>
type Redemption = Details['redemptions'][number]

/** Status chip tone per redemption status. */
const TONE = { issued: 'info', used: 'success', cancelled: 'neutral', expired: 'neutral' } as const

/** A code nobody used yet can be cancelled for the points back (store credit rewards cannot). */
const cancellable = (r: Redemption) =>
  (r.status === 'issued' || r.status === 'expired') && r.rewardType !== 'store_credit'

/**
 * The v2 part of the customer page's Loyalty card: tier and what reaches the next, lifetime
 * points, the referral code and friends referred, and the rewards redeemed with "Cancel code".
 */
export default function CustomerLoyaltyExtras({ customerId }: CustomerLoyaltyExtrasProps) {
  // Hooks
  const copy = useCopy(loyaltyCustomerContent)
  const locale = useLocale()
  const { hasPermission } = usePermissions()
  const [cancelling, setCancelling] = useState<Redemption | null>(null)
  const { data, retry } = useLoad<Details>(() => api.loyalty.customer({ customerId }), [customerId])

  // Effects
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry only bumps a state counter
  useEffect(() => {
    window.addEventListener(STORE_CREDIT_CHANGED_EVENT, retry)
    return () => window.removeEventListener(STORE_CREDIT_CHANGED_EVENT, retry)
  }, [])

  // Event handlers
  const handleCancel = async () => {
    if (!cancelling) return
    try {
      await api.loyalty.redemptions.cancel({ id: cancelling.id })
      toast.success(copy.cancelled)
      setCancelling(null)
      // The points card and Store credit read the balance again (this card too).
      announceStoreCreditChanged()
    } catch (err) {
      toast.error(errorText(err, copy.cancelFailed))
      throw err
    }
  }

  // Early returns
  if (!data) return null

  // Render logic
  const { tier } = data
  const canEdit = hasPermission(permissions.CUSTOMERS_WRITE)
  const nextWhat =
    tier.basis === 'spend' ? formatPaise(tier.toNext, locale) : copy.points(tier.toNext)

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-muted-foreground">{copy.tier}</span>
        {tier.current ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-caption font-medium"
            style={
              tier.current.colors
                ? {
                    backgroundColor: tier.current.colors.background,
                    color: tier.current.colors.text,
                  }
                : undefined
            }
          >
            {tier.current.name}
          </span>
        ) : (
          <span className="text-body text-muted-foreground">{copy.noTier}</span>
        )}
      </div>
      {tier.next ? (
        <span className="text-caption text-muted-foreground">
          {copy.toNext(nextWhat, tier.next.name)}
        </span>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-muted-foreground">{copy.lifetime}</span>
        <span className="text-body tabular-nums text-foreground">
          {copy.points(data.lifetimePoints)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-muted-foreground">{copy.referral}</span>
        <span className="flex flex-col items-end">
          <span className="font-mono text-body text-foreground">{data.referral.code}</span>
          <span className="text-caption text-muted-foreground">
            {copy.referralCount(data.referral.completed)}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption text-muted-foreground">{copy.rewards}</span>
        {data.redemptions.length === 0 ? (
          <span className="text-caption text-muted-foreground">{copy.noRewards}</span>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-2">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-foreground">{r.title}</span>
                    <span className="block text-caption text-muted-foreground">
                      {r.code ? `${r.code} · ` : ''}
                      {copy.points(r.points)} · {formatDay(r.createdAt, new Date(), locale)}
                      {copy.via[r.via] ? ` · ${copy.via[r.via]}` : ''}
                    </span>
                  </span>
                  <StatusChip tone={TONE[r.status]}>{copy.statuses[r.status]}</StatusChip>
                </span>
                {canEdit && cancellable(r) ? (
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
                      {copy.cancel}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => (!open ? setCancelling(null) : undefined)}
        title={copy.cancelTitle}
        body={copy.cancelBody(copy.points(cancelling?.points ?? 0))}
        confirmLabel={copy.cancel}
        tone="destructive"
        onConfirm={handleCancel}
      />
    </div>
  )
}
