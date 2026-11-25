'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { appsContent } from '@/data/apps'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy, useFormat, useLocale } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'
import { routes } from '@/lib/routes'

/** The Loyalty points app's home: points given, taken back and on the way, and the latest points. */
export default function LoyaltyOverviewPage() {
  // Hooks
  const copy = useCopy(loyaltyContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const locale = useLocale()
  const { data, failed, retry } = useLoad(() => api.loyalty.overview({ days: 30 }), [])

  // Render logic
  const o = copy.overview

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={o.title} summary={o.subtitle} />
      {failed ? (
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.overview}
          failed={failed}
          onRetry={retry}
        />
      ) : data ? (
        <>
          <StatStrip
            tiles={[
              {
                id: 'earned',
                label: o.earned,
                value: f.number(data.earnedPoints),
                note: o.earnedNote,
              },
              {
                id: 'taken',
                label: o.takenBack,
                value: f.number(data.takenBackPoints),
                note: o.takenBackNote,
              },
              {
                id: 'customers',
                label: o.customers,
                value: f.number(data.customers),
                note: o.customersNote,
              },
              {
                id: 'pending',
                label: o.pending,
                value: f.number(data.pendingPoints),
                note: o.pendingNote,
              },
            ]}
          />
          <DataCard title={o.recentTitle} flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>{o.columns.customer}</TableHead>
                  <TableHead className={HEAD}>{o.columns.what}</TableHead>
                  <TableHead className={HEAD}>{o.columns.status}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{o.columns.points}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{o.columns.when}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.length === 0 ? (
                  <TableEmptyRow colSpan={5} message={o.recentEmpty} />
                ) : null}
                {data.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${CELL} font-medium`}>
                      <Link
                        href={routes.customers.detail(r.customerId)}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.customerName || r.customerEmail}
                      </Link>
                    </TableCell>
                    <TableCell className={CELL}>{r.reason}</TableCell>
                    <TableCell className={CELL}>{copy.statuses[r.status] ?? r.status}</TableCell>
                    <TableCell
                      className={`${CELL} text-right tabular-nums ${r.points > 0 ? 'text-success' : ''}`}
                    >
                      {r.points > 0 ? '+' : '−'}
                      {f.number(Math.abs(r.points))}
                    </TableCell>
                    <TableCell className={`${CELL} text-right text-muted-foreground`}>
                      {formatDay(r.createdAt, new Date(), locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataCard>
        </>
      ) : (
        <>
          <StatStrip tiles={[]} loading placeholders={4} />
          <DataCardSkeleton fields={0} lines={4} />
        </>
      )}
    </div>
  )
}
