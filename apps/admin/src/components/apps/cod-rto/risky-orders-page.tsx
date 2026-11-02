'use client'

import { RISK_ORDER_FILTERS, type RiskOrderFilter } from '@commerce/core/cod-rto'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
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
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import StatusChip from '@/components/layout/status-chip'
import LinkRow from '@/components/table/link-row'
import TableEmptyRow from '@/components/table/table-empty-row'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RiskChip from './risk-chip'

type Page = Awaited<ReturnType<typeof api.codRto.orders>>

const PER_PAGE = 25

/** Orders the score calls risky, and COD orders waiting for (or past) the customer's answer. */
export default function RiskyOrdersPage() {
  // Hooks
  const copy = useCopy(codRtoContent)
  const f = useFormat()
  const [filter, setFilter] = useState<RiskOrderFilter>('risky')
  const [openOnly, setOpenOnly] = useState(true)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)

  useEffect(() => {
    let cancelled = false
    api.codRto.orders({ filter, openOnly, page, perPage: PER_PAGE }).then((r) => {
      if (!cancelled) setData(r)
    })
    return () => {
      cancelled = true
    }
  }, [filter, openOnly, page])

  // Event handlers
  const handleFilter = (next: RiskOrderFilter) => {
    setFilter(next)
    setPage(1)
  }

  const handleOpenOnly = (on: boolean) => {
    setOpenOnly(on)
    setPage(1)
  }

  // Render logic
  const c = copy.orders
  const pages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={c.title} summary={c.subtitle} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          value={filter}
          onChange={handleFilter}
          tabs={RISK_ORDER_FILTERS.map((v) => ({ value: v, label: c.tabs[v] ?? v }))}
        />
        <div className="flex items-center gap-2">
          <Switch id="risky-open-only" checked={openOnly} onCheckedChange={handleOpenOnly} />
          <Label htmlFor="risky-open-only" className="text-body">
            {c.openOnly}
          </Label>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl surface-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{c.columns.order}</TableHead>
              <TableHead className={HEAD}>{c.columns.customer}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{c.columns.total}</TableHead>
              <TableHead className={HEAD}>{c.columns.payment}</TableHead>
              <TableHead className={HEAD}>{c.columns.risk}</TableHead>
              <TableHead className={HEAD}>{c.columns.answer}</TableHead>
              <TableHead className={HEAD}>{c.columns.placed}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data && data.items.length === 0 ? (
              <TableEmptyRow colSpan={7} message={c.empty} />
            ) : null}
            {(data?.items ?? []).map((o) => (
              <LinkRow href={routes.orders.detail(o.id)} key={o.id}>
                <TableCell className={`${CELL} font-medium`}>
                  <Link href={routes.orders.detail(o.id)} className="hover:underline">
                    #{o.number}
                  </Link>
                </TableCell>
                <TableCell className={CELL}>{o.customerName || o.email || c.guest}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(o.totalPaise)}
                </TableCell>
                <TableCell className={CELL}>
                  {o.paymentMethod === 'cod' ? c.cod : c.prepaid}
                </TableCell>
                <TableCell className={CELL}>
                  {o.level ? (
                    <RiskChip
                      level={o.level}
                      label={copy.levels[o.level] ?? o.level}
                      score={o.score}
                    />
                  ) : null}
                </TableCell>
                <TableCell className={CELL}>
                  {o.verification ? (
                    <StatusChip
                      variant="dot"
                      tone={o.verification === 'unconfirmed' ? 'attention' : 'neutral'}
                    >
                      {copy.verification[o.verification] ?? o.verification}
                    </StatusChip>
                  ) : null}
                </TableCell>
                <TableCell className={`${CELL} text-muted-foreground`}>
                  {f.date(o.placedAt)}
                </TableCell>
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {c.prev}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {c.next}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
