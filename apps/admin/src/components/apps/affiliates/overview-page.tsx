'use client'

import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import AffiliateTrendCard from '@/components/apps/affiliates/affiliate-trend-card'
import DefaultProgramCard from '@/components/apps/affiliates/default-program-card'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import LinkRow from '@/components/table/link-row'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/**
 * Affiliates › Home, laid out like UpPromote's: the stat strip (sales, referrals, clicks,
 * affiliates), the default program with its registration link, then who waits for you, trends
 * and the top affiliates. All-time figures: the overview read has no date range.
 */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(affiliatesContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const { home } = useCopy(affiliatesLayoutContent)
  const { data, failed, retry } = useLoad(() => api.affiliates.overview())
  // The default program and the store's address, for the registration link card.
  const { data: programs } = useLoad(() => api.affiliates.programs.list())
  const { data: origin } = useLoad(() => api.store.origin())

  // Early returns
  if (failed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.overview}
        failed={failed}
        onRetry={retry}
      />
    )
  }
  if (!data) {
    // Five figures, the trend card and the top affiliates table.
    return (
      <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5" aria-busy="true">
        <StatStrip tiles={[]} loading placeholders={4} />
        <DataCardSkeleton fields={0} lines={4} />
        <DataCardSkeleton fields={0} lines={3} />
      </div>
    )
  }

  // Render logic
  const t = data.totals
  const fallback = programs?.find((p) => p.isDefault && !p.archivedAt)
  const link = origin !== null ? `${origin.replace(/\/+$/, '')}/affiliate` : null
  const h = home.tiles

  return (
    // UpPromote's column: about 50rem, centred, like the Loyalty app's Home.
    <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
      <PageHeader title={home.title} summary={home.summary} />
      {data.active ? null : (
        <Alert tone="danger">
          <AlertDescription>{copy.paused}</AlertDescription>
        </Alert>
      )}
      <StatStrip
        tiles={[
          { id: 'sales', label: h.sales, value: f.money(t.salesPaise), note: h.salesNote },
          {
            id: 'referrals',
            label: h.referrals,
            value: f.number(t.orders),
            note: h.referralsNote,
          },
          { id: 'clicks', label: h.clicks, value: f.number(t.clicks) },
          {
            id: 'affiliates',
            label: h.affiliates,
            value: f.number(data.approved),
            note: h.affiliatesNote,
          },
        ]}
      />
      {fallback && link ? (
        <DefaultProgramCard
          programId={fallback.id}
          commission={fallback.rules.commission}
          link={link}
        />
      ) : null}
      {data.waitingApproval > 0 || data.readyToPay > 0 ? (
        <div className="flex flex-col gap-3">
          {data.waitingApproval > 0 ? (
            <Alert
              tone="info"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.apps.page('affiliates', 'affiliates')} />}
                >
                  {copy.review}
                </Button>
              }
            >
              <AlertDescription>{copy.waiting(data.waitingApproval)}</AlertDescription>
            </Alert>
          ) : null}
          {data.readyToPay > 0 ? (
            <Alert
              tone="info"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.apps.page('affiliates', 'payouts')} />}
                >
                  {copy.pay}
                </Button>
              }
            >
              <AlertDescription>{copy.readyToPay(data.readyToPay)}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
      <AffiliateTrendCard />
      <DataCard title={copy.topTitle} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.columns.affiliate}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.orders}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.sales}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.commission}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.top.length === 0 ? <TableEmptyRow colSpan={4} message={copy.topEmpty} /> : null}
            {data.top.map((a) => (
              <LinkRow href={routes.apps.page('affiliates', 'affiliates', a.id)} key={a.id}>
                <TableCell className={`${CELL} font-medium`}>
                  <Link
                    className="hover:underline"
                    href={routes.apps.page('affiliates', 'affiliates', a.id)}
                  >
                    {a.name || a.code}
                  </Link>
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.number(a.orders)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(a.salesPaise)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(a.commissionPaise)}
                </TableCell>
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  )
}
