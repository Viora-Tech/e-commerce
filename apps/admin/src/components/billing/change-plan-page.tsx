'use client'

import type { PlanView } from '@commerce/core'
import {
  type BillingInterval,
  nextPlanUp,
  PLANS,
  type PlanId,
  planRank,
} from '@commerce/core/billing'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import PlanChooser from './plan-chooser'

type ChangePlanPageProps = { view: PlanView }

/** Orders past this share of the plan's included orders point to the next plan up. */
const SUGGEST_AT = 0.8

/**
 * Settings → Plan & billing → Change plan (Figma 931:10521): a full page instead of the
 * cramped popup, with the plan the store's orders point to marked Suggested, and a confirm
 * step (931:11086) saying whether it is paid now or starts at the period's end.
 */
export default function ChangePlanPage({ view }: ChangePlanPageProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const router = useRouter()
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [asking, setAsking] = useState<{ plan: PlanId; interval: BillingInterval } | null>(null)

  // Event handlers
  const handleChoose = async (plan: PlanId, interval: BillingInterval) => {
    setBusy(plan)
    try {
      const r = await api.billing.choose({ plan, interval })
      if (r.scheduled) {
        toast.success(copy.dialog.scheduledToast(copy.plans[plan].name))
        router.push(routes.settings.billing())
      } else if (r.bill?.url) {
        window.location.assign(r.bill.url)
      } else {
        router.push(routes.settings.billing())
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.dialog.failed)
    } finally {
      setBusy(null)
      setAsking(null)
    }
  }

  // Render logic
  const c = copy.changePlan
  const plan = PLANS[view.plan]
  const up = nextPlanUp(view.plan)
  const suggested = up && view.usage.orders >= plan.orders * SUGGEST_AT ? up : null
  const lower = asking ? planRank(asking.plan) < planRank(view.plan) : false
  const askedName = asking ? copy.plans[asking.plan].name : ''
  const askedPrice = asking ? format.money(PLANS[asking.plan].pricePaise[asking.interval]) : ''

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title={c.title}
        subtitle={
          suggested ? `${c.subtitle} ${c.basedOn(format.number(view.usage.orders))}` : c.subtitle
        }
        back={{ label: c.back, href: routes.settings.billing() }}
      />
      <PlanChooser
        current={view.plan}
        currentInterval={view.interval}
        paid={view.status === 'active'}
        busy={busy}
        suggested={suggested}
        onChoose={(p, interval) => setAsking({ plan: p, interval })}
      />
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={c.confirmTitle(askedName)}
        body={
          lower && view.periodEnd
            ? c.downgradeBody(askedName, format.date(view.periodEnd))
            : c.upgradeBody(askedName, askedPrice)
        }
        confirmLabel={c.confirm(askedName)}
        cancelLabel={c.cancel}
        tone="default"
        busy={busy !== null}
        onConfirm={() => (asking ? handleChoose(asking.plan, asking.interval) : undefined)}
      />
    </div>
  )
}
