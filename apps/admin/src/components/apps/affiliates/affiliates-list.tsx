'use client'

import { siteConfig } from '@commerce/config/site'
import { Users } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useState } from 'react'
import AddAffiliateDialog from '@/components/apps/affiliates/add-affiliate-dialog'
import AffiliateRowActions from '@/components/apps/affiliates/affiliate-row-actions'
import { statusTone } from '@/components/apps/affiliates/tones'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliateFiltersContent } from '@/data/affiliate-filters'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import {
  AFFILIATE_FILTER_PARAMS,
  affiliateFilterGroups,
  affiliateFilterInput,
  CLEAR_AFFILIATE_FILTERS,
} from '@/lib/affiliate-list-filters'
import { api } from '@/lib/api-client'
import { PAGE_FILL_CHAIN } from '@/lib/page-fill'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.affiliates.list>>[number]
type Program = { id: string; name: string }

/**
 * Every affiliate, waiting ones first to approve, with what each earned. With none yet, UpPromote's
 * empty state (two people, "Manage affiliate list", Add affiliate) stands in for the table.
 */
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
  const { affiliates: layout } = useCopy(affiliatesLayoutContent)
  const apps = useCopy(appsContent)
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
  // Search and filters run on the server; paging stays in the browser (the list is capped at 1000).
  const {
    data: rows,
    failed,
    loading,
    retry,
  } = useLoad<Row[]>(
    () => api.affiliates.list({ search: q.query || undefined, ...affiliateFilterInput(q) }),
    [q],
  )
  // The program filter's options; without them the filter lists none.
  const { data: programList } = useLoad(() => api.affiliates.programs.list())
  const [adding, setAdding] = useState(false)

  // Event handlers
  const handleChanged = retry

  // Render logic
  const programs: Program[] = (programList ?? []).map((p) => ({ id: p.id, name: p.name }))
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
  const none = !filtered && !failed && rows !== null && rows.length === 0

  return (
    <div className={cn('flex flex-col gap-5', PAGE_FILL_CHAIN)}>
      <PageHeader
        title={l.title}
        actions={<Button onClick={() => setAdding(true)}>{l.add}</Button>}
      />
      {none ? (
        <EmptyState
          variant="page"
          icon={Users}
          heading={layout.emptyTitle}
          body={layout.emptyBody}
          action={<Button onClick={() => setAdding(true)}>{l.add}</Button>}
        />
      ) : (
        <ResourceTable
          fill
          resourceName={l.resource}
          columns={columns}
          items={visible}
          getId={(r) => r.id}
          href={(r) => routes.apps.page('affiliates', 'affiliates', r.id)}
          selectable={false}
          loading={loading && rows === null && !failed}
          error={
            failed ? { heading: apps.couldNotLoad.affiliates, onRetry: handleChanged } : undefined
          }
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
      )}
      <AddAffiliateDialog open={adding} onOpenChange={setAdding} onAdded={handleChanged} />
    </div>
  )
}
