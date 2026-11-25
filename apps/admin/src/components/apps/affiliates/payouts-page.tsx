'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MarkPaidDialog from '@/components/apps/affiliates/mark-paid-dialog'
import PaymentCandidatesTable from '@/components/apps/affiliates/payment-candidates-table'
import PayoutsTable from '@/components/apps/affiliates/payouts-table'
import TdsReportDialog from '@/components/apps/affiliates/tds-report-dialog'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import PillTabs from '@/components/layout/pill-tabs'
import SectionHead from '@/components/layout/section-head'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type Candidate = Awaited<ReturnType<typeof api.affiliates.payouts.candidates>>[number]
type Payout = Awaited<ReturnType<typeof api.affiliates.payouts.list>>[number]
type Tab = 'approved' | 'paid'

/** Saves text as a file in the browser (the bank CSV); nothing leaves except to the merchant's disk. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Affiliates › Payments, laid out like UpPromote's: Approved referrals (who is owed, then the
 * payouts made and waiting to be marked paid) and Paid referrals. Export payments is the bank
 * bulk-upload file; the TDS report stays. No money moves here.
 */
export default function PayoutsPage() {
  // Hooks
  const { payouts: copy, failed } = useCopy(affiliatesContent)
  const { payments: layout } = useCopy(affiliatesLayoutContent)
  const apps = useCopy(appsContent)
  const [tab, setTab] = useState<Tab>('approved')
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [payouts, setPayouts] = useState<Payout[] | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  /** Which action is running: `create`, or the id of the payout being cancelled. */
  const [busy, setBusy] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    setLoadFailed(false)
    Promise.all([api.affiliates.payouts.candidates(), api.affiliates.payouts.list()]).then(
      ([c, p]) => {
        if (cancelled) return
        setCandidates(c)
        setPayouts(p)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [reload])

  // Helpers
  const run = async (action: string, fn: () => Promise<string>) => {
    setBusy(action)
    try {
      toast.success(await fn())
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(errorText(err, failed))
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleCreate = (affiliateIds?: string[]) =>
    run('create', async () =>
      copy.created(
        (await api.affiliates.payouts.create(affiliateIds ? { affiliateIds } : {})).created,
      ),
    )
  const handleCancel = (id: string) =>
    run(id, async () => {
      await api.affiliates.payouts.cancel({ id })
      return copy.cancelled
    })
  const handleExport = async () => {
    try {
      const { csv } = await api.affiliates.payouts.exportCsv({})
      download(`affiliate-payouts-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    } catch (err) {
      toast.error(errorText(err, failed))
    }
  }

  // Early returns
  if ((!candidates || !payouts) && loadFailed) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.payouts}
          onRetry={() => setReload((n) => n + 1)}
        />
      </div>
    )
  }
  if (!candidates || !payouts) {
    // Header with its three buttons, the tabs and the table.
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeaderSkeleton title={copy.title} actions={3} />
        <DataCardSkeleton fields={0} lines={4} />
      </div>
    )
  }

  // Render logic
  const ready = candidates.filter((c) => c.ready).length
  const pending = payouts.filter((p) => p.status === 'pending')
  const paid = payouts.filter((p) => p.status === 'paid')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <>
            <Button variant="outline" onClick={() => setReporting(true)}>
              {copy.tdsReport}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={pending.length === 0}>
              {layout.export}
            </Button>
            <Button
              onClick={() => handleCreate()}
              disabled={busy !== null || ready === 0}
              loading={busy === 'create'}
            >
              {copy.create}
            </Button>
          </>
        }
      />
      <PillTabs
        variant="segmented"
        label={layout.tabsLabel}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'approved', label: layout.tabs.approved, count: candidates.length },
          { value: 'paid', label: layout.tabs.paid, count: paid.length },
        ]}
      />
      {tab === 'approved' ? (
        <>
          <PaymentCandidatesTable
            candidates={candidates}
            busy={busy !== null}
            onCreate={handleCreate}
          />
          {pending.length > 0 ? (
            <section className="flex flex-col gap-4">
              <SectionHead title={layout.toPayTitle} />
              <PayoutsTable
                payouts={pending}
                mode="pending"
                busy={busy}
                onCancel={handleCancel}
                onMarkPaid={setPaying}
              />
            </section>
          ) : null}
        </>
      ) : (
        <PayoutsTable payouts={paid} mode="paid" busy={busy} />
      )}
      <p className="text-caption text-muted-foreground">{copy.exportNote}</p>
      <TdsReportDialog open={reporting} onOpenChange={setReporting} onDownload={download} />
      <MarkPaidDialog
        payoutId={paying}
        onOpenChange={(open) => {
          if (!open) setPaying(null)
        }}
        onPaid={() => setReload((n) => n + 1)}
      />
    </div>
  )
}
