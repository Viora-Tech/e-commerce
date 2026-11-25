'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Payout = Awaited<ReturnType<typeof api.affiliates.payouts.list>>[number]

type PayoutsTableProps = {
  payouts: Payout[]
  /** `pending`: payouts made but not paid yet, with Cancel and Mark paid. `paid`: the paid ones. */
  mode: 'pending' | 'paid'
  /** The id of the payout being cancelled, or any other action running. */
  busy: string | null
  onCancel?: (id: string) => void
  onMarkPaid?: (id: string) => void
}

/** Payments: payouts to mark paid, or the paid ones with their UTR (Paid referrals). */
export default function PayoutsTable({
  payouts,
  mode,
  busy,
  onCancel,
  onMarkPaid,
}: PayoutsTableProps) {
  // Hooks
  const { payouts: copy } = useCopy(affiliatesContent)
  const { payments: layout } = useCopy(affiliatesLayoutContent)
  const f = useFormat()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Render logic
  const cols = layout.columns
  const all: (ResourceColumnSpec<Payout> | null)[] = [
    {
      id: 'affiliate',
      title: cols.affiliate,
      hideable: false,
      align: 'start',
      sortValue: (p) => p.name || p.code,
      render: (p) => <span className="font-medium">{p.name || p.code}</span>,
    },
    { id: 'info', title: cols.info, render: (p) => p.payoutHint ?? '—' },
    {
      id: 'total',
      title: cols.total,
      sortValue: (p) => p.netPaise,
      render: (p) => <span className="font-medium">{f.money(p.netPaise)}</span>,
    },
    { id: 'gst', title: cols.gst, render: (p) => (p.gstPaise ? f.money(p.gstPaise) : '—') },
    { id: 'tds', title: cols.tds, render: (p) => f.money(p.tdsPaise) },
    mode === 'paid'
      ? { id: 'reference', title: cols.reference, render: (p) => p.reference || '—' }
      : null,
    {
      id: 'date',
      title: cols.date,
      sortValue: (p) => new Date(mode === 'paid' && p.paidAt ? p.paidAt : p.createdAt),
      render: (p) => f.date(mode === 'paid' && p.paidAt ? p.paidAt : p.createdAt),
    },
    mode === 'pending'
      ? {
          id: 'actions',
          title: '',
          hideable: false,
          render: (p) => (
            <span className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCancel?.(p.id)}
                disabled={busy !== null}
                loading={busy === p.id}
              >
                {copy.cancel}
              </Button>
              <Button size="sm" onClick={() => onMarkPaid?.(p.id)}>
                {copy.markPaid}
              </Button>
            </span>
          ),
        }
      : null,
  ]
  const columns = all.filter((c): c is ResourceColumnSpec<Payout> => c !== null)
  const needle = query.trim().toLowerCase()
  const matching = payouts.filter(
    (p) =>
      !needle ||
      [p.name, p.code, p.payoutHint ?? '', p.reference].some((v) =>
        v.toLowerCase().includes(needle),
      ),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <ResourceTable
      resourceName={layout.payoutResource}
      columns={columns}
      items={visible}
      getId={(p) => p.id}
      selectable={false}
      query={query}
      onQueryChange={(q) => {
        setQuery(q)
        setPage(1)
      }}
      page={page}
      perPage={perPage}
      total={matching.length}
      onPageChange={setPage}
      onPerPageChange={(n) => {
        setPerPage(n)
        setPage(1)
      }}
      empty={
        mode === 'paid'
          ? { heading: layout.noData }
          : { heading: layout.noData, body: copy.historyEmpty }
      }
    />
  )
}
