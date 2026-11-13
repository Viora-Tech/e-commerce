'use client'

import type { PlanView } from '@commerce/core'
import {
  APP_PRICING,
  type BillingInterval,
  PLANS,
  type PlanChangeQuote,
  type PlanId,
  planRank,
} from '@commerce/core/billing'
import { CheckIcon } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { billAmount, lastDay } from '@/lib/billing'
import { routes } from '@/lib/routes'

export type PlanTarget = { plan: PlanId; interval: BillingInterval }

type PlanMoveDialogProps = {
  view: PlanView
  /** The plan picked; null keeps the dialog closed. */
  target: PlanTarget | null
  onClose: () => void
  /** Names of the paid apps the store bought, by plugin id. */
  boughtApps?: Record<string, string> | undefined
}

/** Bought apps the new plan includes: they stop billing on their own. */
const nowIncluded = (plan: PlanId, bought: Record<string, string>): string[] =>
  Object.entries(bought).flatMap(([id, name]) => {
    const price = APP_PRICING[id]
    return price && planRank(plan) >= planRank(price.includedFrom) ? [name] : []
  })

/**
 * Figma 931:11086 "Move to Pro?": the server's quote (`billing.quote`, the same one `choose`
 * bills) as a breakdown, what the plan brings, and "Pay ₹X and move". A downgrade says when it
 * starts and charges nothing.
 */
export default function PlanMoveDialog({
  view,
  target,
  onClose,
  boughtApps = {},
}: PlanMoveDialogProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const router = useRouter()
  const [quote, setQuote] = useState<PlanChangeQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    setQuote(null)
    setFailed(null)
    if (!target) return
    let live = true
    api.billing
      .quote(target)
      .then((q) => {
        if (live) setQuote(q)
      })
      .catch((err: unknown) => {
        if (live) setFailed(err instanceof Error && err.message ? err.message : '')
      })
    return () => {
      live = false
    }
  }, [target])

  // Event handlers
  const handleConfirm = async () => {
    if (!target) return
    setBusy(true)
    try {
      const r = await api.billing.choose(target)
      if (r.scheduled) {
        toast.success(copy.dialog.scheduledToast(copy.plans[target.plan].name))
        onClose()
        router.push(routes.settings.billing())
        router.refresh()
      } else if (r.bill?.url) {
        window.location.assign(r.bill.url)
      } else {
        onClose()
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.dialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const c = copy.move
  const name = target ? copy.plans[target.plan].name : ''
  const plan = target ? PLANS[target.plan] : null
  const charge = quote?.kind === 'charge' ? quote : null
  const title = copy.changePlan.confirmTitle(name)
  const body =
    quote?.kind === 'scheduled'
      ? copy.changePlan.downgradeBody(name, format.date(quote.startsAt))
      : quote?.kind === 'same'
        ? c.already
        : charge?.creditPlan
          ? c.bodyProrated(name, copy.plans[charge.creditPlan].name)
          : charge
            ? c.bodyFull(name)
            : failed !== null
              ? failed || c.failed
              : c.loading
  const confirmLabel = charge
    ? c.pay(format.money(charge.totalPaise))
    : copy.changePlan.confirm(name)
  const renewal = charge
    ? charge.interval === 'year'
      ? copy.perYear(format.money(charge.renewalPaise))
      : copy.perMonth(format.money(charge.renewalPaise))
    : ''
  const included = target ? nowIncluded(target.plan, boughtApps) : []
  const gets = plan
    ? [
        c.getOrders(format.number(plan.orders), format.number(view.usage.orders)),
        [c.getStaff(format.number(plan.staff)), plan.features.allApps ? c.everyApp : null]
          .filter(Boolean)
          .join(' · '),
        ...(included.length > 0 ? [c.stopsBilling(included.join(', '))] : []),
      ]
    : []

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      cancelLabel={copy.changePlan.cancel}
      tone="default"
      busy={busy}
      confirmDisabled={!quote || quote.kind === 'same'}
      onConfirm={handleConfirm}
    >
      {charge ? (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-body">
            <Line
              label={c.planLine(
                name,
                format.date(charge.periodStart),
                format.date(lastDay(charge.periodEnd)),
              )}
              value={billAmount(charge.newPlanPaise, format.intl)}
            />
            {charge.creditPlan ? (
              <Line
                label={c.credit(copy.plans[charge.creditPlan].name)}
                value={`− ${billAmount(charge.creditPaise, format.intl)}`}
              />
            ) : null}
            <Line label={c.gst} value={billAmount(charge.gstPaise, format.intl)} />
            {charge.feesPaise > 0 ? (
              <Line label={c.fees} value={billAmount(charge.feesPaise, format.intl)} />
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2 font-medium text-ink-strong">
              <dt>{c.payNow}</dt>
              <dd className="tabular-nums">{billAmount(charge.totalPaise, format.intl)}</dd>
            </div>
            <Line label={c.from(format.date(charge.renewsAt))} value={c.renewal(renewal)} />
          </dl>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-muted-foreground uppercase">
              {c.youGet}
            </span>
            <ul className="flex flex-col gap-1 text-body">
              {gets.map((g) => (
                <li key={g} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </ConfirmDialog>
  )
}

/** One label and amount of the breakdown. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  )
}
