'use client'

import { AppWindow, CancelCircle, CheckIcon, PackageOpen, Settings } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import { returnColumns } from '@/components/returns/return-columns'
import ReturnsListDialogs, {
  listActions,
  type ReturnsListRequest,
} from '@/components/returns/returns-list-dialogs'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { returnDetailContent, returnListActionsContent, returnsContent } from '@/data/returns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { RETURN_LIST_FILTERS, type ReturnListFilter, returnListFilter } from '@/lib/return-filter'
import { routes } from '@/lib/routes'
import { parseRowsPerPage } from '@/lib/rows-per-page'

type ListResult = Awaited<ReturnType<typeof api.returns.list>>
type Item = ListResult['items'][number]
type Counts = Awaited<ReturnType<typeof api.returns.counts>>

export type ReturnsInitial = {
  query: ListQuery<ReturnListFilter>
  perPage: number
  result: ListResult
  counts: Counts
}

function fetchReturns(q: ListQuery<ReturnListFilter>, perPage: number) {
  return api.returns.list({
    page: q.page,
    perPage,
    search: q.query || undefined,
    ...returnListFilter(q.status),
  })
}

function ReturnsContent({ initial }: { initial: ReturnsInitial }) {
  // Hooks
  const copy = useCopy(returnsContent)
  const detail = useCopy(returnDetailContent)
  const actions = useCopy(returnListActionsContent)
  const router = useRouter()
  const fmt = useFormat()
  const [{ page, query, status, perPage: rawPerPage }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(RETURN_LIST_FILTERS),
      perPage: parseAsInteger.withDefault(initial.perPage),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [request, setRequest] = useState<ReturnsListRequest | null>(null)

  const hydrated = useRef(false)

  useEffect(() => {
    const size = parseRowsPerPage(rawPerPage)
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      size === initial.perPage &&
      sameListQuery({ page, query, status }, initial.query)
    )
      return
    let cancelled = false
    setLoading(true)
    fetchReturns({ page, query, status }, size)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, query, status, rawPerPage, initial.query, initial.perPage])

  // Helpers
  const reload = async () => {
    const r = await fetchReturns({ page, query, status }, parseRowsPerPage(rawPerPage))
    setItems(r.items)
    setTotal(r.total)
    // The tab counts and the summary line come from the server render.
    router.refresh()
  }
  const ask = (kind: ReturnsListRequest['kind'], ids: string[], clear: () => void = () => {}) =>
    setRequest({ kind, ids, clear })

  // Event handlers
  const handleDone = () => {
    setRequest(null)
    reload().catch(() => undefined)
  }

  // Render logic
  const perPage = parseRowsPerPage(rawPerPage)
  const c = initial.counts
  const counts: Record<ReturnListFilter, number | undefined> = {
    requested: c.requested,
    inProgress: c.inProgress,
    received: c.received,
    done: undefined,
    rto: c.rto,
  }

  return (
    <ProoflyListPage
      title={copy.title}
      summary={c.requested > 0 ? copy.needDecision(c.requested) : copy.subtitle}
      actions={
        <Button
          variant="outline"
          render={<Link href={routes.settings.returns()} />}
          nativeButton={false}
        >
          <Settings aria-hidden="true" />
          {copy.rules}
        </Button>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={returnColumns(copy, fmt)}
        items={items}
        getId={(r) => r.id}
        href={(r) => routes.orders.returnDetail(r.id)}
        rowActions={(r) => {
          const can = listActions(r)
          return (
            <RowMenu
              items={[
                { label: copy.openReturn, href: routes.orders.returnDetail(r.id), icon: AppWindow },
                {
                  label: detail.decision.approve,
                  icon: CheckIcon,
                  hidden: !can.approve,
                  separatorBefore: true,
                  onSelect: () => ask('approve', [r.id]),
                },
                {
                  label: detail.receive.button,
                  icon: PackageOpen,
                  hidden: !can.receive,
                  onSelect: () => ask('receive', [r.id]),
                },
                {
                  label: actions.close,
                  hidden: !can.resolve,
                  onSelect: () => ask('close', [r.id]),
                },
                {
                  label: detail.rejectDialog.confirm,
                  icon: CancelCircle,
                  destructive: true,
                  hidden: !can.reject,
                  onSelect: () => ask('reject', [r.id]),
                },
              ]}
            />
          )
        }}
        selectable
        bulkActions={(ids, clear) => (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ask('approve', ids, clear)}
            >
              <CheckIcon aria-hidden="true" />
              {actions.approveSelected(ids.length)}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ask('close', ids, clear)}
            >
              {actions.closeSelected(ids.length)}
            </Button>
          </>
        )}
        loading={loading}
        query={query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, page: 1 })}
        views={
          <ViewSelect<ReturnListFilter | null>
            label={copy.viewLabel}
            value={status}
            onChange={(s) => setQ({ status: s, page: 1 })}
            formatCount={fmt.number}
            options={[
              { value: null, label: copy.tabs.all, count: c.all },
              ...RETURN_LIST_FILTERS.map((s) => ({
                value: s,
                label: copy.tabs[s],
                ...(counts[s] !== undefined ? { count: counts[s] } : {}),
              })),
            ]}
          />
        }
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
        empty={{ heading: copy.empty, body: copy.subtitle }}
      />
      <ReturnsListDialogs
        request={request}
        items={items}
        onClose={() => setRequest(null)}
        onDone={handleDone}
      />
    </ProoflyListPage>
  )
}

export default function ReturnsPage({ initial }: { initial: ReturnsInitial }) {
  return (
    <Suspense>
      <ReturnsContent initial={initial} />
    </Suspense>
  )
}
