'use client'

import { siteConfig } from '@commerce/config/site'
import { Inbox } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  type CommissionRow,
  commissionColumns,
} from '@/components/apps/affiliates/commission-columns'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import { affiliateFiltersContent } from '@/data/affiliate-filters'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  CLEAR_COMMISSION_FILTERS,
  COMMISSION_FILTER_PARAMS,
  commissionFilterGroups,
  commissionFilterInput,
} from '@/lib/affiliate-list-filters'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'

type Affiliate = { id: string; name: string }

/** Rows placed in the current calendar month (the browser's), for "Referrals recorded this month". */
const thisMonth = (rows: CommissionRow[], now = new Date()) =>
  rows.filter((r) => {
    const d = new Date(r.placedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

/**
 * Affiliates › Referrals (UpPromote's name for the commissions ledger): every order an affiliate
 * brought and where its commission stands, with this month's count under the title.
 */
export default function CommissionsList() {
  return (
    <Suspense>
      <CommissionsTable />
    </Suspense>
  )
}

function CommissionsTable() {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const { referrals: layout } = useCopy(affiliatesLayoutContent)
  const apps = useCopy(appsContent)
  const filtersCopy = useCopy(affiliateFiltersContent)
  const panelCopy = useCopy(filterPanelContent)
  const f = useFormat()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      ...COMMISSION_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [rows, setRows] = useState<CommissionRow[] | null>(null)
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dueCount, setDueCount] = useState(0)
  /** The last read failed: the table says so with Try again. */
  const [failed, setFailed] = useState(false)

  // Search and filters run on the server; paging stays in the browser (newest 1000 matches).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    api.affiliates.commissions
      .list({ search: q.query || undefined, ...commissionFilterInput(q) })
      .then(
        (r) => {
          if (cancelled) return
          setFailed(false)
          setRows(r)
        },
        () => {
          if (!cancelled) setFailed(true)
        },
      )
    return () => {
      cancelled = true
    }
  }, [q, reload])
  // "Approve due now" is off while nothing is due (#77).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the count after a change
  useEffect(() => {
    api.affiliates.commissions
      .dueCount()
      .then(setDueCount)
      .catch(() => setDueCount(0))
  }, [reload])
  useEffect(() => {
    api.affiliates
      .list()
      .then((all) => setAffiliates(all.map((a) => ({ id: a.id, name: a.name || a.code }))))
      .catch(() => undefined)
  }, [])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)
  const handleApproveDue = async () => {
    setBusy(true)
    try {
      const r = await api.affiliates.commissions.approveDue()
      toast.success(copy.commissions.approvedDue(r.approved, r.reversed))
      handleChanged()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const matching = rows ?? []
  const visible = matching.slice((q.page - 1) * q.perPage, q.page * q.perPage)
  const groups = commissionFilterGroups(q, copy, filtersCopy, panelCopy, affiliates, (patch) =>
    setQ({ ...patch, page: 1 }),
  )
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query.length > 0
  const none = !filtered && !failed && rows !== null && rows.length === 0
  // The count is of the whole ledger, so it shows only while nothing narrows the list.
  const summary = rows && !filtered ? layout.thisMonth(thisMonth(rows)) : copy.commissions.subtitle

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.commissions.title}
        summary={summary}
        actions={
          <Button variant="outline" onClick={handleApproveDue} disabled={busy || dueCount === 0}>
            {copy.commissions.approveDue}
          </Button>
        }
      />
      {none ? (
        <EmptyState
          variant="page"
          icon={Inbox}
          heading={layout.emptyTitle}
          body={layout.emptyBody}
        />
      ) : (
        <ResourceTable
          resourceName={copy.commissions.resource}
          columns={commissionColumns(copy, f, handleChanged, { withAffiliate: true })}
          items={visible}
          getId={(r) => r.id}
          href={(r) => routes.orders.detail(r.orderId)}
          selectable={false}
          loading={rows === null && !failed}
          error={
            failed ? { heading: apps.couldNotLoad.commissions, onRetry: handleChanged } : undefined
          }
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
          onClearAll={() => setQ({ ...CLEAR_COMMISSION_FILTERS, query: '', page: 1 })}
          filterGroups={groups}
          page={q.page}
          perPage={q.perPage}
          total={matching.length}
          onPageChange={(page) => setQ({ page })}
          onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
          empty={filtered ? filtersCopy.commissions.noResults : { heading: copy.commissions.empty }}
        />
      )}
    </div>
  )
}
