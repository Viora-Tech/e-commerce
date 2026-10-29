'use client'

import { siteConfig } from '@commerce/config/site'
import { permissions } from '@commerce/core/permissions'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import type { StoreLocation } from '@/components/inventory/location-select'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import SingleLocation from '@/components/transfers/single-location'
import { transferColumns } from '@/components/transfers/transfer-columns'
import TransferRowMenu from '@/components/transfers/transfer-row-menu'
import { filterPanelContent } from '@/data/filter-panel'
import { TRANSFER_STATUSES, type TransferStatus, transfersContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import {
  CLEAR_TRANSFER_FILTERS,
  hasTransferFilters,
  TRANSFER_FILTER_PARAMS,
  type TransferFilters,
  transferFilterGroups,
  transferFilterInput,
} from '@/lib/transfer-list-filters'

type ListResult = Awaited<ReturnType<typeof api.transfers.list>>

/** First page rendered on the server so the table never paints empty. */
export type TransfersInitial = {
  query: ListQuery<TransferStatus>
  result: ListResult
  allCount: number
  locations: StoreLocation[]
}

const PER_PAGE = siteConfig.ui.rowsPerPage.default
const NEW_HREF = routes.stock.newTransfer()

type Query = TransferFilters & {
  page: number
  perPage: number
  query: string
  status: TransferStatus | null
}

function listInput(q: Query) {
  return {
    page: q.page,
    perPage: q.perPage,
    search: q.query || undefined,
    status: q.status ?? undefined,
    ...transferFilterInput(q),
  }
}

function TransfersContent({ initial }: { initial: TransfersInitial }) {
  // Hooks
  const copy = useCopy(transfersContent)
  const panelCopy = useCopy(filterPanelContent)
  usePrimaryAction(NEW_HREF)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(PER_PAGE),
      status: parseAsStringLiteral(TRANSFER_STATUSES),
      ...TRANSFER_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.result.rows)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  const hydrated = useRef(false)

  useEffect(() => {
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      sameListQuery(q, initial.query) &&
      q.perPage === PER_PAGE &&
      !hasTransferFilters(q)
    )
      return
    let cancelled = false
    setLoading(true)
    api.transfers
      .list(listInput(q))
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setTotal(r.total)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query])

  // Helpers
  const refresh = async () => {
    const r = await api.transfers.list(listInput(q))
    setRows(r.rows)
    setTotal(r.total)
  }

  // Render logic
  const canWrite = hasPermission(permissions.INVENTORY_WRITE)
  const single = initial.locations.length < 2
  const groups = transferFilterGroups(
    q,
    copy.filters,
    copy.status,
    panelCopy,
    initial.locations,
    (patch) => setQ({ ...patch, page: 1 }),
  )
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query.length > 0
  const create = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
            <Plus strokeWidth={1.6} />
            {copy.create}
          </Button>
        }
      />
      <TooltipContent>
        {copy.create} <Kbd>N</Kbd>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary}
      actions={single ? undefined : create}
    >
      {single && initial.allCount === 0 ? (
        <SingleLocation canAdd={canWrite} onAdd={() => setAdding(true)} />
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={transferColumns}
          items={rows}
          getId={(r) => r.id}
          href={(r) => routes.stock.transfer(r.id)}
          rowActions={
            canWrite
              ? (r) => <TransferRowMenu transfer={r} onChanged={() => void refresh()} />
              : undefined
          }
          loading={loading}
          selectable={false}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 })}
          onClearAll={() => setQ({ ...CLEAR_TRANSFER_FILTERS, query: '', status: null, page: 1 })}
          filters={(close) => (
            <FilterPanel
              groups={groups}
              onClear={() => clearGroups(groups)}
              footer={{ label: panelCopy.show(total), onDone: close }}
            />
          )}
          filtersClassName={FILTER_PANEL_CLASS}
          applied={applied}
          views={
            <ViewSelect
              value={q.status}
              onChange={(status) => setQ({ status, page: 1 })}
              options={[
                { value: null, label: copy.tabs.all, count: initial.allCount },
                ...TRANSFER_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
              ]}
            />
          }
          page={q.page}
          perPage={q.perPage}
          onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
          total={total}
          onPageChange={(page) => setQ({ page })}
          empty={
            filtered
              ? copy.noResults
              : {
                  heading: copy.empty.heading,
                  body: copy.empty.body,
                  action: (
                    <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
                      <Plus />
                      {copy.create}
                    </Button>
                  ),
                }
          }
        />
      )}
      <AddLocationDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => router.refresh()}
      />
    </ProoflyListPage>
  )
}

export default function TransfersPage({ initial }: { initial: TransfersInitial }) {
  return (
    <Suspense>
      <TransfersContent initial={initial} />
    </Suspense>
  )
}
