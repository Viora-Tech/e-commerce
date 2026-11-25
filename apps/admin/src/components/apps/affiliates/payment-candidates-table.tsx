'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Candidate = Awaited<ReturnType<typeof api.affiliates.payouts.candidates>>[number]

type PaymentCandidatesTableProps = {
  candidates: Candidate[]
  busy: boolean
  /** Makes payouts for these affiliates (only the ready ones are made). */
  onCreate: (affiliateIds: string[]) => void
}

/**
 * Payments › Approved referrals: who is owed, one row per affiliate (UpPromote's columns:
 * Affiliate, Payment info, Referrals, Total amount), ticked rows made into payouts together.
 */
export default function PaymentCandidatesTable({
  candidates,
  busy,
  onCreate,
}: PaymentCandidatesTableProps) {
  // Hooks
  const { payouts: copy } = useCopy(affiliatesContent)
  const { payments: layout } = useCopy(affiliatesLayoutContent)
  const f = useFormat()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Render logic
  const cols = layout.columns
  const columns: ResourceColumnSpec<Candidate>[] = [
    {
      id: 'affiliate',
      title: cols.affiliate,
      hideable: false,
      align: 'start',
      sortValue: (c) => c.name || c.code,
      render: (c) => <span className="font-medium">{c.name || c.code}</span>,
    },
    {
      id: 'info',
      title: cols.info,
      render: (c) =>
        c.blocker ? (
          <StatusChip tone="attention">{copy.blockers[c.blocker]}</StatusChip>
        ) : (
          (c.payoutHint ?? '—')
        ),
    },
    {
      id: 'referrals',
      title: cols.referrals,
      sortValue: (c) => c.commissions,
      render: (c) => f.number(c.commissions),
    },
    {
      id: 'commission',
      title: cols.commission,
      sortValue: (c) => c.grossPaise,
      render: (c) => f.money(c.grossPaise),
    },
    {
      id: 'clawback',
      title: cols.clawback,
      render: (c) => (c.clawbackPaise ? f.money(-c.clawbackPaise) : '—'),
    },
    { id: 'gst', title: cols.gst, render: (c) => (c.gstPaise ? f.money(c.gstPaise) : '—') },
    { id: 'tds', title: cols.tds, render: (c) => f.money(c.tdsPaise) },
    {
      id: 'total',
      title: cols.total,
      sortValue: (c) => c.netPaise,
      render: (c) => <span className="font-medium">{f.money(c.netPaise)}</span>,
    },
  ]
  const needle = query.trim().toLowerCase()
  const matching = candidates.filter(
    (c) =>
      !needle || [c.name, c.code, c.payoutHint ?? ''].some((v) => v.toLowerCase().includes(needle)),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <ResourceTable
      resourceName={layout.resource}
      columns={columns}
      items={visible}
      getId={(c) => c.affiliateId}
      defaultHidden={['clawback', 'gst', 'tds']}
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
      bulkActions={(ids, clear) => (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            onCreate(ids)
            clear()
          }}
        >
          {layout.createSelected}
        </Button>
      )}
      empty={{ heading: layout.noData, body: copy.readyEmpty }}
    />
  )
}
