import { isPlanId } from '@commerce/core/billing'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatTile from '@/components/layout/stat-tile'
import { billingContent } from '@/data/billing'
import { platformContent } from '@/data/platform'
import { appRouter, call } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { formatPaise } from '@/lib/money'
import { platformCallOptions } from '@/lib/platform-access'

/** Platform console → Overview: the whole platform at a glance (staff only). */
export default async function PlatformOverviewPage() {
  const o = await call(appRouter.platform.overview, undefined, await platformCallOptions())
  const copy = await getCopy(platformContent)
  const t = copy.overview
  const windows = [
    { label: t.today, w: o.sales.today },
    { label: t.days7, w: o.sales.days7 },
    { label: t.days30, w: o.sales.days30 },
  ]

  return (
    <PageBody>
      <PageHeader title={t.title} summary={copy.notice} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t.total}
          value={String(o.stores.total)}
          note={t.newThisWeek(o.stores.newThisWeek)}
        />
        <StatTile label={t.active} value={String(o.stores.active)} />
        <StatTile label={t.trialing} value={String(o.stores.trialing)} />
        <StatTile label={t.paused} value={String(o.stores.paused)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title={t.salesTitle} subtitle={t.salesNote}>
          <div className="grid gap-4 sm:grid-cols-3">
            {windows.map(({ label, w }) => (
              <StatTile
                key={label}
                label={label}
                value={formatPaise(w.gmvPaise)}
                note={t.orders(w.orders)}
              />
            ))}
          </div>
        </DataCard>

        <DataCard title={t.subscriptionsTitle} subtitle={t.mrrNote}>
          <KeyValueList
            variant="grid"
            rows={[
              { label: t.mrr, value: formatPaise(o.subscriptions.mrrPaise), strong: true },
              ...o.subscriptions.plans.map((p) => ({
                label: isPlanId(p.plan) ? billingContent.plans[p.plan].name : p.plan,
                value: `${t.payingStores(p.stores)} · ${formatPaise(p.mrrPaise)}`,
              })),
              { label: t.cancelled, value: String(o.stores.cancelled), tone: 'muted' as const },
              { label: t.noPlan, value: String(o.stores.noPlan), tone: 'muted' as const },
            ]}
          />
        </DataCard>

        <DataCard title={t.paymentsTitle}>
          <KeyValueList
            variant="grid"
            rows={[
              { label: t.billsDue, value: String(o.payments.billsDue) },
              {
                label: t.billsOverdue,
                value: String(o.payments.billsOverdue),
                tone: o.payments.billsOverdue > 0 ? 'danger' : 'default',
              },
              {
                label: t.autopayHalted,
                value: String(o.payments.autopayHalted),
                tone: o.payments.autopayHalted > 0 ? 'danger' : 'default',
              },
            ]}
          />
        </DataCard>

        <DataCard title={t.reportsTitle}>
          <KeyValueList
            variant="grid"
            rows={[
              {
                label: t.openReports,
                value: o.openReports === null ? t.reportsUnavailable : String(o.openReports),
                tone: o.openReports === null ? 'muted' : 'default',
              },
            ]}
          />
        </DataCard>
      </div>

      <DataCard title={t.healthTitle} flush>
        <div className="px-5 pb-4">
          <KeyValueList
            variant="grid"
            rows={[
              { label: t.outboxPending, value: String(o.outbox.pending) },
              {
                label: t.outboxFailing,
                value: String(o.outbox.failing),
                tone: o.outbox.failing > 0 ? 'danger' : 'default',
              },
              {
                label: t.oldestPending,
                value: o.outbox.oldestPendingAt ? (
                  <RelativeTime value={o.outbox.oldestPendingAt} />
                ) : null,
              },
            ]}
          />
        </div>
        {o.queues ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.queue}</TableHead>
                <TableHead className="text-right">{t.waiting}</TableHead>
                <TableHead className="text-right">{t.activeJobs}</TableHead>
                <TableHead className="text-right">{t.delayed}</TableHead>
                <TableHead className="text-right">{t.failed}</TableHead>
                <TableHead>{t.oldestWaiting}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.queues.map((q) => (
                <TableRow key={q.name}>
                  <TableCell className="font-mono text-caption">{q.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{q.waiting}</TableCell>
                  <TableCell className="text-right tabular-nums">{q.active}</TableCell>
                  <TableCell className="text-right tabular-nums">{q.delayed}</TableCell>
                  <TableCell
                    className={
                      q.failed > 0
                        ? 'text-right text-danger tabular-nums'
                        : 'text-right tabular-nums'
                    }
                  >
                    {q.failed}
                  </TableCell>
                  <TableCell>
                    {q.oldestWaitingAt ? <RelativeTime value={q.oldestWaitingAt} /> : copy.dash}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-5 pb-5 text-body text-muted-foreground">{t.queuesUnavailable}</p>
        )}
      </DataCard>
    </PageBody>
  )
}
