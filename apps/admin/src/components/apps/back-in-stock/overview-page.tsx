'use client'

import { Bell, Send as Mail, Package as PackageSearch, TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import DateRangePicker from '@/components/layout/date-range-picker'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { type HomeRange, rangeFor } from '@/lib/home-range'
import { rangeInstants } from '@/lib/loyalty-insights'
import { routes } from '@/lib/routes'
import DemandTable from './demand-table'
import { exportSignups } from './export-signups'

const PRESETS = ['7d', '30d', 'thisMonth', 'lastMonth', 'thisQuarter', 'custom'] as const

/** Percent change, or null when the earlier period had nothing to compare with. */
function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null
  return Math.round(((now - before) / before) * 100)
}

/**
 * The app's home in Essential's back-in-stock layout: Import / Export / Edit campaign, the
 * campaign-off banner, this month's free sending, the campaign row, Analytics (four figures
 * against the period before and the per-product list) and General settings.
 */
export default function OverviewPage() {
  // Hooks
  const { overview: copy, signups: sCopy } = useCopy(backInStockContent)
  const f = useFormat()
  const [range, setRange] = useState<HomeRange>(() => rangeFor('30d'))
  const [busy, setBusy] = useState<'import' | 'export' | 'on' | null>(null)
  const { data, failed, retry, setData } = useLoad(
    () => api.backInStock.overview(rangeInstants(range)),
    [range.from, range.to],
  )

  // Event handlers
  const handleImport = async () => {
    setBusy('import')
    try {
      const r = await api.backInStock.signups.importRestockTags()
      toast.success(sCopy.restockTagsDone(r.added, r.unmatched.length))
      setData(await api.backInStock.overview(rangeInstants(range)))
    } catch (err) {
      toast.error(errorText(err, String(err)))
    } finally {
      setBusy(null)
    }
  }
  const handleExport = async () => {
    setBusy('export')
    await exportSignups({
      header: sCopy.csvHeader,
      file: copy.exportFile,
      failed: copy.exportFailed,
    })
    setBusy(null)
  }
  const handleTurnOn = async () => {
    setBusy('on')
    try {
      await api.backInStock.settings.save({ enabled: true })
      setData(await api.backInStock.overview(rangeInstants(range)))
    } catch (err) {
      toast.error(errorText(err, String(err)))
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  const campaignHref = routes.apps.page('back-in-stock', 'campaign')
  const header = (
    <PageHeader
      title={copy.title}
      summary={copy.subtitle}
      actions={
        <>
          <Button variant="outline" loading={busy === 'import'} onClick={handleImport}>
            {copy.importTags}
          </Button>
          <Button variant="outline" loading={busy === 'export'} onClick={handleExport}>
            {copy.exportSignups}
          </Button>
          <Button nativeButton={false} render={<Link href={campaignHref} />}>
            {copy.editCampaign}
          </Button>
        </>
      }
    />
  )
  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
        {header}
        {failed ? (
          <LoadFailedState size="page" heading={copy.loadFailed} failed={failed} onRetry={retry} />
        ) : (
          <>
            <DataCardSkeleton fields={0} lines={2} />
            <DataCardSkeleton fields={0} lines={5} />
          </>
        )}
      </div>
    )
  }

  // Render logic
  const { usage, summary, campaign } = data
  const cur = summary.current
  const prev = summary.previous
  const emailPct =
    usage.email.unlimited || usage.email.quota <= 0
      ? 0
      : Math.min(100, (usage.email.sent / usage.email.quota) * 100)
  const usedUp = !usage.email.unlimited && usage.email.quota > 0 && emailPct >= 100

  return (
    <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
      {header}
      {campaign.enabled ? null : (
        <Alert
          tone="warning"
          action={
            <Button size="sm" variant="outline" loading={busy === 'on'} onClick={handleTurnOn}>
              {copy.turnOn}
            </Button>
          }
        >
          <TriangleAlert />
          <AlertTitle>{copy.offTitle}</AlertTitle>
          <AlertDescription>{copy.offBody}</AlertDescription>
        </Alert>
      )}
      <DataCard bodyClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-body">
            <span className="font-semibold text-ink-strong">{copy.usageFree}</span>{' '}
            <span className="text-muted-foreground">{copy.usageTitle.toLowerCase()}</span>
          </p>
          {usage.whatsapp.quota > 0 || usage.whatsapp.sent > 0 ? (
            <p className="text-caption text-muted-foreground tabular-nums">
              {copy.ofQuota(usage.whatsapp.sent, usage.whatsapp.quota)} {copy.whatsappUsage}
            </p>
          ) : null}
        </div>
        {usage.email.unlimited ? (
          <p className="text-body text-muted-foreground">{copy.unlimited}</p>
        ) : (
          <>
            <Progress value={emailPct} />
            <p className="text-body tabular-nums">
              <span className="font-semibold">
                {copy.ofQuota(usage.email.sent, usage.email.quota)}
              </span>{' '}
              {copy.emailUsage}
            </p>
          </>
        )}
        {usedUp ? <p className="text-caption text-destructive">{copy.paused}</p> : null}
      </DataCard>
      <DataCard title={copy.campaignTitle} subtitle={copy.campaignHelp} flush>
        <Link
          href={campaignHref}
          className="flex items-center gap-3 border-hairline border-t px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <Bell className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-body font-medium">{campaign.title}</span>
          <StatusChip tone={campaign.enabled ? 'success' : 'neutral'}>
            {campaign.enabled ? copy.live : copy.off}
          </StatusChip>
        </Link>
      </DataCard>
      <DataCard
        title={copy.statsTitle}
        action={<DateRangePicker range={range} presets={PRESETS} onApply={(r) => setRange(r)} />}
        flush
      >
        <div className="border-hairline border-t p-4">
          <StatStrip
            tiles={[
              {
                id: 'waiting',
                label: copy.tiles.waiting,
                value: f.number(summary.waiting),
                note: copy.waitingNote,
              },
              {
                id: 'new',
                label: copy.tiles.newSignups,
                value: f.number(cur.newSignups),
                trend: change(cur.newSignups, prev.newSignups),
                trendNote: copy.vsBefore,
              },
              {
                id: 'notified',
                label: copy.tiles.notified,
                value: f.number(cur.notified),
                trend: change(cur.notified, prev.notified),
                trendNote: copy.vsBefore,
              },
              {
                id: 'orders',
                label: copy.tiles.orders,
                value: f.number(cur.orders),
                trend: change(cur.orders, prev.orders),
                note: copy.ordersNote(f.moneyWhole(cur.revenuePaise)),
              },
            ]}
          />
        </div>
        <DemandTable rows={data.variants} />
      </DataCard>
      <DataCard title={copy.settingsTitle} subtitle={copy.settingsHelp} flush>
        <div className="flex items-center gap-3 border-hairline border-t px-4 py-3">
          <PackageSearch className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium">{copy.whereTitle}</p>
            <p className="text-caption text-muted-foreground">{copy.whereBody}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`${campaignHref}?tab=products`} />}
          >
            {copy.manage}
          </Button>
        </div>
        <div className="flex items-center gap-3 border-hairline border-t px-4 py-3">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium">{copy.senderTitle}</p>
            <p className="text-caption text-muted-foreground">{copy.senderBody}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={routes.settings.notifications()} />}
          >
            {copy.manage}
          </Button>
        </div>
      </DataCard>
    </div>
  )
}
