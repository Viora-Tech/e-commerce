'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import ImportPointsDialog from '@/components/apps/loyalty/import-points-dialog'
import ResetPointsDialog from '@/components/apps/loyalty/reset-points-dialog'
import ActionMenu from '@/components/layout/action-menu'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { FilterGroup } from '@/components/table/filter-panel'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import {
  exportFileName,
  memberSortInput,
  memberSortParam,
  parseMemberSort,
} from '@/lib/loyalty-insights'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.loyalty.members.list>>['rows'][number]

const STATUSES = ['active', 'excluded'] as const

/** Saves text as a file in the browser; nothing leaves except to the merchant's disk. */
function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Everyone in the loyalty program (Essential Loyalty's layout): Activity and More actions in the
 * header, an All / Active / Excluded view beside the search, then name, status, tier, points,
 * lifetime points and total spent (Joined can be shown from the columns menu).
 */
export default function LoyaltyMembersPage() {
  return (
    <Suspense>
      <MembersTable />
    </Suspense>
  )
}

function MembersTable() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      tier: parseAsString.withDefault(''),
      status: parseAsString.withDefault(''),
      sort: parseAsString.withDefault(''),
    },
    { shallow: true },
  )
  const { data, failed, loading, retry } = useLoad(
    () =>
      api.loyalty.members.list({
        page: q.page,
        perPage: q.perPage,
        search: q.query || undefined,
        tierId: q.tier || undefined,
        status: q.status === 'active' || q.status === 'excluded' ? q.status : 'all',
        ...memberSortInput(q.sort),
      }),
    [q],
  )
  const { data: tiers } = useLoad(() => api.loyalty.tiers.list())
  const [importing, setImporting] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Event handlers
  const handleExport = async () => {
    try {
      const { csv } = await api.loyalty.members.export()
      saveFile(exportFileName(), csv)
      toast.success(copy.members.exported)
    } catch (err) {
      toast.error(errorText(err, copy.members.exportFailed))
    }
  }

  // Render logic
  const m = copy.members
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'name',
      title: m.columns.name,
      hideable: false,
      align: 'start',
      className: 'w-60',
      sortValue: (r) => r.name ?? r.email ?? '',
      sortLabels: m.sortLabels.name,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium">{r.name || r.email}</span>
          {r.name ? <span className="text-caption text-muted-foreground">{r.email}</span> : null}
        </span>
      ),
    },
    {
      id: 'status',
      title: m.columns.status,
      render: (r) => (
        <StatusChip tone={r.status === 'active' ? 'success' : 'neutral'}>
          {m.status[r.status] ?? r.status}
        </StatusChip>
      ),
    },
    {
      id: 'tier',
      title: m.columns.tier,
      render: (r) => r.tierName ?? <span className="text-muted-foreground">{m.noTier}</span>,
    },
    {
      id: 'points',
      title: m.columns.points,
      align: 'end',
      render: (r) => <span className="tabular-nums">{f.number(r.points)}</span>,
    },
    {
      id: 'lifetime',
      title: m.columns.lifetime,
      align: 'end',
      sortValue: (r) => r.lifetimePoints,
      sortLabels: m.sortLabels.number,
      render: (r) => <span className="tabular-nums">{f.number(r.lifetimePoints)}</span>,
    },
    {
      id: 'spent',
      title: m.columns.spent,
      align: 'end',
      sortValue: (r) => r.totalSpentPaise,
      sortLabels: m.sortLabels.number,
      render: (r) => <span className="tabular-nums">{f.moneyWhole(r.totalSpentPaise)}</span>,
    },
    {
      id: 'joined',
      title: m.columns.joined,
      sortValue: (r) => new Date(r.joinedAt),
      sortLabels: m.sortLabels.date,
      render: (r) => <RelativeTime value={r.joinedAt} />,
    },
  ]
  const tierOptions = [
    ...(tiers ?? []).map((t) => ({ value: t.id, label: t.name })),
    { value: 'none', label: m.noTier },
  ]
  const groups: FilterGroup[] = [
    {
      key: 'tier',
      label: m.filters.tier,
      type: 'select',
      options: tierOptions,
      value: q.tier || null,
      anyLabel: m.filters.any,
      onChange: (tier) => setQ({ tier: tier ?? '', page: 1 }),
    },
  ]
  const filtered = q.query.length > 0 || q.tier !== '' || q.status !== ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={m.title}
        summary={m.summary}
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('loyalty', 'activity')} />}
            >
              {m.activity}
            </Button>
            <ActionMenu
              label={m.moreActions}
              trigger="button"
              variant="outline"
              items={[
                { label: m.import, onSelect: () => setImporting(true) },
                { label: m.export, onSelect: handleExport },
                { label: m.reset, destructive: true, onSelect: () => setResetting(true) },
              ]}
            />
          </>
        }
      />
      <ResourceTable
        resourceName={m.resource}
        columns={columns}
        items={data?.rows ?? []}
        getId={(r) => r.customerId}
        href={(r) => routes.customers.detail(r.customerId)}
        selectable={false}
        loading={loading && data === null && !failed}
        error={failed ? { heading: m.loadFailed, onRetry: retry } : undefined}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setQ({ query: '', tier: '', status: '', page: 1 })}
        views={
          <ViewSelect
            value={q.status === 'active' || q.status === 'excluded' ? q.status : null}
            label={m.viewLabel}
            onChange={(status) => setQ({ status: status ?? '', page: 1 })}
            options={[
              { value: null, label: m.views.all },
              ...STATUSES.map((s) => ({ value: s, label: m.status[s] ?? s })),
            ]}
          />
        }
        filterGroups={groups}
        defaultHidden={['joined']}
        defaultSort={{ id: 'joined', desc: true }}
        sort={parseMemberSort(q.sort)}
        onSortChange={(s) => setQ({ sort: memberSortParam(s), page: 1 })}
        page={q.page}
        perPage={q.perPage}
        total={data?.total ?? 0}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        empty={{ heading: m.empty, body: m.emptyBody }}
        noResults={filtered ? { heading: m.noResults } : undefined}
      />
      <ImportPointsDialog open={importing} onOpenChange={setImporting} onImported={retry} />
      <ResetPointsDialog open={resetting} onOpenChange={setResetting} onReset={retry} />
    </div>
  )
}
