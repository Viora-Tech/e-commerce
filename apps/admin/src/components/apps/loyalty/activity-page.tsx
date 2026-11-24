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
import { useState } from 'react'
import { toast } from 'sonner'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import TableEmptyRow from '@/components/table/table-empty-row'
import { loyaltyContent } from '@/data/loyalty'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'

type Item = Awaited<ReturnType<typeof api.loyalty.activity>>[number]

const PAGE = 50

/** The store-wide loyalty feed: every points move and tier change, newest first, 50 at a time. */
export default function LoyaltyActivityPage() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const points = useCopy(loyaltyContent)
  const f = useFormat()
  const { data, failed, retry, setData } = useLoad(
    () => api.loyalty.activity({ before: null, limit: PAGE }),
    [],
  )
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)

  // Helpers
  const whatOf = (item: Item): string => {
    if (item.kind === 'points') return item.reason || (points.sources[item.source] ?? item.source)
    const a = copy.activity
    if (item.fromTier && item.toTier) return a.tierUp(item.fromTier, item.toTier)
    if (item.toTier) return a.tierFirst(item.toTier)
    return a.tierLeft(item.fromTier ?? '')
  }

  // Event handlers
  const handleMore = async () => {
    const last = data?.at(-1)
    if (!last) return
    setBusy(true)
    try {
      const next = await api.loyalty.activity({ before: new Date(last.at), limit: PAGE })
      setData((prev) => [...(prev ?? []), ...next])
      if (next.length < PAGE) setMore(false)
    } catch (err) {
      toast.error(errorText(err, copy.activity.loadFailed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const a = copy.activity
  const header = (
    <PageHeader
      title={a.title}
      summary={a.summary}
      back={{ label: a.back, href: routes.apps.page('loyalty', 'members') }}
    />
  )

  return (
    <div className="flex flex-col gap-5">
      {header}
      {failed ? (
        <LoadFailedState size="page" heading={a.loadFailed} failed={failed} onRetry={retry} />
      ) : data ? (
        <DataCard
          flush
          footer={
            more && data.length >= PAGE ? (
              <Button variant="outline" size="sm" onClick={handleMore} disabled={busy}>
                {a.more}
              </Button>
            ) : undefined
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD}>{a.columns.customer}</TableHead>
                <TableHead className={HEAD}>{a.columns.what}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{a.columns.points}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{a.columns.when}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? <TableEmptyRow colSpan={4} message={a.empty} /> : null}
              {data.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell className={`${CELL} font-medium`}>
                    <Link
                      href={routes.customers.detail(item.customerId)}
                      className="underline-offset-4 hover:underline"
                    >
                      {item.customerName || item.customerEmail}
                    </Link>
                  </TableCell>
                  <TableCell className={CELL}>
                    {whatOf(item)}
                    {item.kind === 'points' && item.status !== 'credited' ? (
                      <span className="ml-2 text-caption text-muted-foreground">
                        {points.statuses[item.status] ?? item.status}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`${CELL} text-right tabular-nums ${item.kind === 'points' && item.points > 0 ? 'text-success' : ''}`}
                  >
                    {item.kind === 'points'
                      ? `${item.points > 0 ? '+' : '−'}${f.number(Math.abs(item.points))}`
                      : null}
                  </TableCell>
                  <TableCell className={`${CELL} text-right text-muted-foreground`}>
                    {f.dateTime(item.at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      ) : (
        <DataCardSkeleton fields={0} lines={8} />
      )}
    </div>
  )
}
