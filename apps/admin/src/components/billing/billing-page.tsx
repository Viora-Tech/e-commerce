'use client'

import type { PlanView } from '@commerce/core'
import { type BillingInterval, PLAN_IDS, type PlanId, planRank } from '@commerce/core/billing'
import { CircleAlert, CreditCard, InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import KeyValueList from '@/components/layout/key-value-list'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { billingContent } from '@/data/billing'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { daysUntil } from '@/lib/billing'
import { routes } from '@/lib/routes'
import SettingsDrill from '../settings/settings-drill'
import SettingsDrillPanel from '../settings/settings-drill-panel'
import AppsCard, { type BoughtApp } from './apps-card'
import AutopayRow, { type AutopayState } from './autopay-row'
import BillsCard from './bills-card'
import ComparePlansDialog from './compare-plans-dialog'
import CurrentPlanCard from './current-plan-card'
import UnlimitedPlanCard from './unlimited-plan-card'
import UsageBillsCard from './usage-bills-card'

type BillingPageProps = { view: PlanView; apps: BoughtApp[]; autopay: AutopayState }

/**
 * Figma "Settings · Plan & billing" (707:119179), Shopify-style (#147): the plan and usage on
 * top, then rows for payment, paid apps, invoices, per-order fee bills and downgrading, each
 * opening in place (`?open=`).
 */
export default function BillingPage({ view, apps, autopay }: BillingPageProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const rowsCopy = useCopy(settingsRowsContent)
  const format = useFormat()
  const router = useRouter()
  const [comparing, setComparing] = useState(false)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [downgrading, setDowngrading] = useState(false)

  // Event handlers
  const handleChoose = async (plan: PlanId, interval: BillingInterval) => {
    setBusy(plan)
    try {
      const r = await api.billing.choose({ plan, interval })
      if (r.scheduled) {
        toast.success(copy.dialog.scheduledToast(copy.plans[plan].name))
        setComparing(false)
        router.refresh()
      } else if (r.bill?.url) {
        window.location.assign(r.bill.url)
      } else {
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.dialog.failed)
    } finally {
      setBusy(null)
    }
  }

  const handleKeepPlan = async () => {
    await api.billing.keepPlan()
    toast.success(copy.current.kept)
    router.refresh()
  }

  // Render logic
  const trialDays = daysUntil(view.trialEndsAt)
  const lower: PlanId | null = PLAN_IDS[planRank(view.plan) - 1] ?? null
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

  // A Koomerce store: nothing to choose, pay or downgrade; its apps still show.
  if (view.unlimited)
    return (
      <div className="flex w-full flex-col gap-4">
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <UnlimitedPlanCard view={view} />
        <AppsCard apps={apps} />
      </div>
    )

  const b = rowsCopy.billing
  const canDowngrade =
    lower !== null && view.status === 'active' && !!view.periodEnd && !view.nextPlan
  const rows = [
    {
      id: 'payment',
      title: copy.payment.heading,
      value: autopay.mandate?.status === 'active' ? b.autopayOn : b.payByLink,
    },
    { id: 'apps', title: copy.apps.heading, value: b.count(apps.length) },
    { id: 'invoices', title: copy.bills.heading, value: b.count(view.bills.length) },
    { id: 'fee-bills', title: copy.feeBills.heading, value: b.count(view.usageBills.length) },
    ...(canDowngrade && lower
      ? [
          {
            id: 'downgrade',
            title: copy.change.heading,
            value: b.downgradeTo(copy.plans[lower].name),
          },
        ]
      : []),
  ]

  return (
    <div className="flex w-full flex-col gap-4">
      <SettingsDrill
        rows={rows}
        backLabel={copy.title}
        header={{
          title: copy.title,
          subtitle: copy.subtitle,
          actions: (
            <Button nativeButton={false} render={<Link href={routes.settings.billingPlans()} />}>
              {copy.changePlan.action}
            </Button>
          ),
          notice: (
            <>
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
              <CurrentPlanCard
                view={view}
                onKeepPlan={handleKeepPlan}
                onCompare={() => setComparing(true)}
              />
            </>
          ),
        }}
      >
        <SettingsDrillPanel id="payment">
          <SettingsCard
            title={copy.payment.heading}
            description={copy.payment.body}
            bodyClassName="gap-4"
          >
            <KeyValueList
              variant="grid"
              rows={[{ label: copy.payment.invoiceEmail, value: view.invoiceEmail ?? '—' }]}
            />
            <AutopayRow autopay={autopay} billingReady={view.billingReady} />
          </SettingsCard>
        </SettingsDrillPanel>
        <SettingsDrillPanel id="apps">
          <AppsCard apps={apps} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="invoices">
          <BillsCard bills={view.bills} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="fee-bills">
          <UsageBillsCard bills={view.usageBills} />
        </SettingsDrillPanel>
        {canDowngrade && lower && view.periodEnd ? (
          <SettingsDrillPanel id="downgrade">
            <SettingsCard
              title={copy.change.heading}
              footer={
                <Button variant="outline" onClick={() => setDowngrading(true)}>
                  {copy.change.action(copy.plans[lower].name)}
                </Button>
              }
            >
              <p className="text-body text-muted-foreground">
                {copy.change.body(copy.plans[lower].name, format.date(view.periodEnd))}
              </p>
            </SettingsCard>
          </SettingsDrillPanel>
        ) : null}
      </SettingsDrill>
      <ComparePlansDialog
        open={comparing}
        onOpenChange={setComparing}
        current={view.plan}
        currentInterval={view.interval}
        paid={view.status === 'active'}
        busy={busy}
        onChoose={handleChoose}
      />
      {lower && view.periodEnd ? (
        <ConfirmDialog
          open={downgrading}
          onOpenChange={setDowngrading}
          title={copy.change.confirmTitle(copy.plans[lower].name)}
          body={copy.change.confirmBody(copy.plans[lower].name, format.date(view.periodEnd))}
          confirmLabel={copy.change.confirm}
          cancelLabel={copy.change.cancel}
          busy={busy !== null}
          onConfirm={() => {
            setDowngrading(false)
            void handleChoose(lower, view.interval)
          }}
        />
      ) : null}
    </div>
  )
}
