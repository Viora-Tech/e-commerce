'use client'

import { siteConfig } from '@commerce/config/site'
import { useEffect, useState } from 'react'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabelChip from '@/components/status/status-label-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { backInStockContent } from '@/data/back-in-stock'
import { api } from '@/lib/api-client'

type Row = Awaited<ReturnType<typeof api.backInStock.signups.list>>[number]

const copy = backInStockContent.signups

const columns: ResourceColumnSpec<Row>[] = [
  {
    id: 'variant',
    title: copy.columns.variant,
    hideable: false,
    align: 'start',
    sortValue: (r) => r.variantLabel,
    render: (r) => <span className="font-medium">{r.variantLabel}</span>,
  },
  {
    id: 'contact',
    title: copy.columns.contact,
    align: 'start',
    sortValue: (r) => r.contact,
    render: (r) => r.contact,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <StatusLabelChip kind="bisSignup" value={r.status} />,
  },
  {
    id: 'created',
    title: copy.columns.created,
    sortValue: (r) => new Date(r.createdAt),
    render: (r) => <RelativeTime value={r.createdAt} />,
  },
]

/** Every "notify me" signup: who is waiting, for what, and where they are in the double opt-in flow. */
export default function SignupsList() {
  // Hooks
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  useEffect(() => {
    let cancelled = false
    api.backInStock.signups.list({}).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  // Render logic
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      r.variantLabel.toLowerCase().includes(needle) ||
      r.contact.toLowerCase().includes(needle),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <ProoflyPageHeader title={copy.title} summary={copy.subtitle} />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: copy.empty }}
      />
    </div>
  )
}
