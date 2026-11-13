'use client'

import type { PlanView } from '@commerce/core'
import type { BillingInterval, PlanId } from '@commerce/core/billing'
import { useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import { billingContent } from '@/data/billing'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import PlanChooser from './plan-chooser'
import PlanMoveDialog, { type PlanTarget } from './plan-move-dialog'

type ChangePlanPageProps = {
  view: PlanView
  /** Paid apps the store bought, by plugin id: the confirm lists the ones the new plan includes. */
  boughtApps: Record<string, string>
}

/**
 * Settings → Plan & billing → Change plan (Figma 931:10521): the plans as cards, the one that
 * costs less at this month's pace marked Suggested, Compare everything, and the "Move to Pro?"
 * confirm (931:11086) with what it costs now.
 */
export default function ChangePlanPage({ view, boughtApps }: ChangePlanPageProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const [target, setTarget] = useState<PlanTarget | null>(null)

  // Event handlers
  const handleChoose = (plan: PlanId, interval: BillingInterval) => setTarget({ plan, interval })
  const handleClose = () => setTarget(null)

  // Render logic
  const c = copy.changePlan

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        back={{ label: c.back, href: routes.settings.billing() }}
      />
      <PlanChooser
        current={view.plan}
        currentInterval={view.interval}
        paid={view.status === 'active'}
        busy={null}
        suggested={view.nudge?.plan ?? null}
        pace={view.pace}
        onChoose={handleChoose}
      />
      <PlanMoveDialog view={view} target={target} onClose={handleClose} boughtApps={boughtApps} />
    </div>
  )
}
