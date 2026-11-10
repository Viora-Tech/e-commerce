'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import AddAffiliateDialog from '@/components/apps/affiliates/add-affiliate-dialog'
import AffiliateRowActions from '@/components/apps/affiliates/affiliate-row-actions'
import { statusTone } from '@/components/apps/affiliates/tones'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliateFiltersContent } from '@/data/affiliate-filters'
import { affiliatesContent } from '@/data/affiliates'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  AFFILIATE_FILTER_PARAMS,
  affiliateFilterGroups,
  affiliateFilterInput,
  CLEAR_AFFILIATE_FILTERS,
} from '@/lib/affiliate-list-filters'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.affiliates.list>>[number]
type Program = { id: string; name: string }

/** Every affiliate, waiting ones first to approve, with what each earned. */
export default function AffiliatesList() {
  return (
    <Suspense>
      <AffiliatesTable />
    </Suspense>
  )
}

function AffiliatesTable() {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const filtersCopy = useCopy(affiliateFiltersContent)
  const panelCopy = useCopy(filterPanelContent)
  const f = useFormat()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      ...AFFILIATE_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [rows, setRows] = useState<Row[] | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  // Search and filters run on the server; paging stays in the browser (the list is capped at 1000).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.affiliates
      .list({ search: q.query || undefined, ...affiliateFilterInput(q) })
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, reload])
  useEffect(() => {
    api.affiliates.programs
      .list()
      .then((all) => setPrograms(all.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => undefined)
  }, [])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)

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
      id: 'program',
      title: l.columns.program,
      sortValue: (r) => r.programName,
      render: (r) => r.programName,
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
  // Waiting applications first, then newest.
  const ordered = [...(rows ?? [])].sort(
    (a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'),
  )
  const visible = ordered.slice((q.page - 1) * q.perPage, q.page * q.perPage)
  const groups = affiliateFilterGroups(q, copy, filtersCopy, panelCopy, programs, (patch) =>
    setQ({ ...patch, page: 1 }),
  )
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query.length > 0

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
        loading={loading && rows === null}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setQ({ ...CLEAR_AFFILIATE_FILTERS, query: '', page: 1 })}
        filterGroups={groups}
        page={q.page}
        perPage={q.perPage}
        total={ordered.length}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        empty={
          filtered ? filtersCopy.affiliates.noResults : { heading: l.empty, body: l.emptyBody }
        }
      />
      <AddAffiliateDialog open={adding} onOpenChange={setAdding} onAdded={handleChanged} />
    </div>
  )
}
