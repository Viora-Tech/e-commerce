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
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import StatStrip from '@/components/layout/stat-strip'
import LinkRow from '@/components/table/link-row'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { appsContent } from '@/data/apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** Sales from affiliates, money on hold and owed, who waits for you, trends, top products and affiliates. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(affiliatesContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const { data, failed, retry } = useLoad(() => api.affiliates.overview())

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
      <div className="flex flex-col gap-5" aria-busy="true">
        <StatStrip tiles={[]} loading placeholders={5} />
        <DataCardSkeleton fields={0} lines={4} />
        <DataCardSkeleton fields={0} lines={3} />
      </div>
    )
  }

  // Render logic
  const t = data.totals

  return (
    <div className="flex flex-col gap-5">
      {/* The app header above already names the app (#77). */}
      {data.active ? null : (
        <Alert tone="danger">
          <AlertDescription>{copy.paused}</AlertDescription>
        </Alert>
      )}
      <StatStrip
        tiles={[
          {
            id: 'sales',
            label: copy.tiles.sales,
            value: f.money(t.salesPaise),
            note: copy.tiles.salesNote,
          },
          {
            id: 'pending',
            label: copy.tiles.pending,
            value: f.money(t.pendingPaise),
            note: copy.tiles.pendingNote,
          },
          { id: 'owed', label: copy.tiles.owed, value: f.money(t.approvedPaise) },
          { id: 'paid', label: copy.tiles.paid, value: f.money(t.paidPaise) },
          { id: 'clicks', label: copy.tiles.clicks, value: f.number(t.clicks) },
        ]}
      />
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
      <p className="text-caption text-muted-foreground">{copy.signupPage}</p>
    </div>
  )
}
