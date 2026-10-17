'use client'

import type { PlanView } from '@commerce/core'
import type { BillingInterval, PlanId } from '@commerce/core/billing'
import { CircleAlert, InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageHeader from '@/components/layout/page-header'
import { billingContent } from '@/data/billing'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { daysUntil } from '@/lib/billing'
import BillsCard from './bills-card'
import ComparePlansDialog from './compare-plans-dialog'
import CurrentPlanCard from './current-plan-card'

type BillingPageProps = { view: PlanView }

/** Figma "Settings · Plan & billing" (707:119179): plan and usage, payment, invoices, downgrade. */
export default function BillingPage({ view }: BillingPageProps) {
  // Hooks
  const copy = useCopy(billingContent)
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
  const lower: PlanId | null =
    view.plan === 'pro' ? 'growth' : view.plan === 'growth' ? 'starter' : null
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

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 md:px-8">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={SETTINGS_BACK}
        actions={
          <Button variant="outline" onClick={() => setComparing(true)}>
            {copy.compare}
          </Button>
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
      <CurrentPlanCard
        view={view}
        onKeepPlan={handleKeepPlan}
        onCompare={() => setComparing(true)}
      />
      <DataCard title={copy.payment.heading} subtitle={copy.payment.body}>
        <KeyValueList
          variant="grid"
          rows={[{ label: copy.payment.invoiceEmail, value: view.invoiceEmail ?? '—' }]}
        />
        <p className="mt-3 text-caption text-muted-foreground">
          {view.billingReady ? copy.payment.autopay : copy.payment.notReady}
        </p>
      </DataCard>
      <BillsCard bills={view.bills} />
      {lower && view.status === 'active' && view.periodEnd && !view.nextPlan ? (
        <DataCard
          title={copy.change.heading}
          subtitle={copy.change.body(copy.plans[lower].name, format.date(view.periodEnd))}
        >
          <Button variant="outline" onClick={() => setDowngrading(true)}>
            {copy.change.action(copy.plans[lower].name)}
          </Button>
        </DataCard>
      ) : null}
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
