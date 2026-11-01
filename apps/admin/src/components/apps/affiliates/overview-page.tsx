'use client'

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
import { useEffect, useState } from 'react'
import AffiliateTrendCard from '@/components/apps/affiliates/affiliate-trend-card'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import StatStrip from '@/components/layout/stat-strip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Overview = Awaited<ReturnType<typeof api.affiliates.overview>>

/** Sales from affiliates, money on hold and owed, who waits for you, trends, top products and affiliates. */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(affiliatesContent)
  const f = useFormat()
  const [data, setData] = useState<Overview | null>(null)

  useEffect(() => {
    let cancelled = false
    api.affiliates.overview().then((r) => {
      if (!cancelled) setData(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Early returns
  if (!data) return null

  // Render logic
  const t = data.totals

  return (
    <div className="flex flex-col gap-5">
      {/* The app header above already names the app (#77). */}
      {data.active ? null : <p className="text-body text-destructive">{copy.paused}</p>}
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
        <div className="flex flex-col gap-3 rounded-xl surface-card px-5 py-4">
          {data.waitingApproval > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-body">{copy.waiting(data.waitingApproval)}</span>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={routes.apps.page('affiliates', 'affiliates')} />}
              >
                {copy.review}
              </Button>
            </div>
          ) : null}
          {data.readyToPay > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-body">{copy.readyToPay(data.readyToPay)}</span>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={routes.apps.page('affiliates', 'payouts')} />}
              >
                {copy.pay}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <AffiliateTrendCard />
      <div className="overflow-hidden rounded-xl surface-card">
        <h2 className="px-6 pt-5 pb-3 text-body font-semibold text-ink-strong">{copy.topTitle}</h2>
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
              <TableRow key={a.id}>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-caption text-muted-foreground">{copy.signupPage}</p>
    </div>
  )
}
