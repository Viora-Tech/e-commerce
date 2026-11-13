'use client'

import type { PlanView } from '@commerce/core'
import type { BillingInterval, NextBill, PlanId } from '@commerce/core/billing'
import { CircleAlert, CreditCard, InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { daysUntil } from '@/lib/billing'
import { routes } from '@/lib/routes'
import AppsCard, { type BoughtApp } from './apps-card'
import type { AutopayState } from './autopay-row'
import BillsCard from './bills-card'
import ComparePlansDialog from './compare-plans-dialog'
import CurrentPlanCard from './current-plan-card'
import NextBillCard from './next-bill-card'
import PlanMoveDialog, { type PlanTarget } from './plan-move-dialog'
import UnlimitedPlanCard from './unlimited-plan-card'
import UsageBillsCard from './usage-bills-card'

type BillingPageProps = {
  view: PlanView
  apps: BoughtApp[]
  autopay: AutopayState
  /** `projectNextBill` for this store; null with nothing to renew. */
  nextBill: NextBill | null
}

/**
 * Figma "Plan & billing" (931:9997): one open page. The plan with its usage and the usage nudge
 * beside the next bill, then apps, invoices and per-order fee bills. Plans are picked on Change
 * plan; the trial banner's "Pick a plan" opens them in a popup.
 */
export default function BillingPage({ view, apps, autopay, nextBill }: BillingPageProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const router = useRouter()
  const [comparing, setComparing] = useState(false)
  const [target, setTarget] = useState<PlanTarget | null>(null)

  // Event handlers
  const handleChoose = (plan: PlanId, interval: BillingInterval) => {
    setComparing(false)
    setTarget({ plan, interval })
  }
  const handleCloseMove = () => setTarget(null)

  const handleKeepPlan = async () => {
    await api.billing.keepPlan()
    toast.success(copy.current.kept)
    router.refresh()
  }

  // Early returns
  // A Koomerce store: nothing to choose, pay or downgrade; its apps still show.
  if (view.unlimited)
    return (
      <div className="flex w-full flex-col gap-4">
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <UnlimitedPlanCard view={view} />
        <AppsCard apps={apps} />
      </div>
    )

  // Render logic
  const trialDays = daysUntil(view.trialEndsAt)
  const banner =
    view.status === 'paused'
      ? { tone: 'danger' as const, text: copy.banners.paused }
      : view.due
        ? {
            tone: 'attention' as const,
            text: copy.banners.due(
              format.money(view.due.amountPaise),
              format.date(view.due.periodStart),
            ),
          }
        : view.status === 'trialing'
          ? {
              tone: 'info' as const,
              text: trialDays > 0 ? copy.banners.trial(trialDays) : copy.banners.trialOver,
            }
          : null
  const appNames = Object.fromEntries(apps.map((a) => [a.id, a.name]))
  const bought = Object.fromEntries(apps.filter((a) => a.access).map((a) => [a.id, a.name]))

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`${routes.settings.billingPlans()}#compare`} />}
            >
              {copy.viewAllPlans}
            </Button>
            <Button nativeButton={false} render={<Link href={routes.settings.billingPlans()} />}>
              {copy.changePlan.action}
            </Button>
          </>
        }
      />
      {banner ? (
        <Alert variant={banner.tone === 'danger' ? 'destructive' : 'default'}>
          {banner.tone === 'info' ? <InfoIcon /> : <CircleAlert />}
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{banner.text}</span>
            {view.due?.url ? (
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={view.due.url} target="_blank" rel="noopener noreferrer" />}
              >
                <CreditCard aria-hidden="true" />
                {copy.banners.pay}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setComparing(true)}>
                {copy.banners.choose}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {view.unpaidFees > 0 ? (
        <Alert>
          <CircleAlert />
          <AlertDescription>
            {copy.banners.unpaidFees(format.money(view.unpaidFees))}
          </AlertDescription>
        </Alert>
      ) : null}
      {view.fairUseNotice ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>{copy.banners.fairUse}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <CurrentPlanCard view={view} onKeepPlan={handleKeepPlan} />
        {nextBill ? (
          <NextBillCard
            bill={nextBill}
            appNames={appNames}
            autopay={autopay}
            billingReady={view.billingReady}
          />
        ) : null}
      </div>
      <AppsCard apps={apps} />
      <BillsCard bills={view.bills} invoiceEmail={view.invoiceEmail} />
      {view.usageBills.length > 0 ? <UsageBillsCard bills={view.usageBills} /> : null}
      <ComparePlansDialog
        open={comparing}
        onOpenChange={setComparing}
        current={view.plan}
        currentInterval={view.interval}
        paid={view.status === 'active'}
        busy={null}
        onChoose={handleChoose}
      />
      <PlanMoveDialog view={view} target={target} onClose={handleCloseMove} boughtApps={bought} />
    </div>
  )
}
