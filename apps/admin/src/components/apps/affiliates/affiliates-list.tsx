'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import AddAffiliateDialog from '@/components/apps/affiliates/add-affiliate-dialog'
import AffiliateRowActions from '@/components/apps/affiliates/affiliate-row-actions'
import { statusTone } from '@/components/apps/affiliates/tones'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.affiliates.list>>[number]

/** Every affiliate, waiting ones first to approve, with what each earned. */
export default function AffiliatesList() {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const f = useFormat()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    api.affiliates.list().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  // Render logic
  const l = copy.list
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'affiliate',
      title: l.columns.affiliate,
      hideable: false,
      align: 'start',
      className: 'w-60',
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium">{r.name || r.code}</span>
          <span className="text-caption text-muted-foreground">{r.email ?? r.social}</span>
        </span>
      ),
    },
    {
      id: 'status',
      title: l.columns.status,
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusChip tone={statusTone(r.status)}>{copy.status[r.status] ?? r.status}</StatusChip>
      ),
    },
    {
      id: 'code',
      title: l.columns.code,
      render: (r) => <span className="font-mono">{r.couponCode ?? r.code}</span>,
    },
    {
      id: 'orders',
      title: l.columns.orders,
      sortValue: (r) => r.orders,
      render: (r) => f.number(r.orders),
    },
    {
      id: 'earned',
      title: l.columns.earned,
      sortValue: (r) => r.earnedPaise,
      render: (r) => f.money(r.earnedPaise),
    },
    {
      id: 'pending',
      title: l.columns.pending,
      sortValue: (r) => r.pendingPaise,
      render: (r) => f.money(r.pendingPaise),
    },
    {
      id: 'joined',
      title: l.columns.joined,
      sortValue: (r) => new Date(r.createdAt),
      render: (r) => <RelativeTime value={r.createdAt} />,
    },
    {
      id: 'actions',
      title: '',
      hideable: false,
      render: (r) => <AffiliateRowActions id={r.id} status={r.status} onChanged={handleChanged} />,
    },
  ]
  const needle = query.trim().toLowerCase()
  // Waiting applications first, then newest.
  const ordered = [...(rows ?? [])].sort(
    (a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'),
  )
  const matching = ordered.filter(
    (r) =>
      !needle ||
      [r.name, r.email, r.code, r.couponCode, r.social].some((v) =>
        v?.toLowerCase().includes(needle),
      ),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l.title}
        actions={<Button onClick={() => setAdding(true)}>{l.add}</Button>}
      />
      <ResourceTable
        resourceName={l.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        href={(r) => routes.apps.page('affiliates', 'affiliates', r.id)}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: l.empty }}
      />
      <AddAffiliateDialog open={adding} onOpenChange={setAdding} onAdded={handleChanged} />
    </div>
  )
}
