'use client'

import { siteConfig } from '@commerce/config/site'
import { PackageCheck, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useRef, useState } from 'react'
import MarkDeliveredDialog from '@/components/inbound-shipments/mark-delivered-dialog'
import ShipmentBulkActions from '@/components/inbound-shipments/shipment-bulk-actions'
import { inboundShipmentColumns } from '@/components/inbound-shipments/shipment-columns'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import DeleteRowMenu from '@/components/table/delete-row-menu'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  inboundShipmentFormContent,
  inboundShipmentsContent,
} from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_INBOUND_SHIPMENT_FILTERS,
  hasInboundShipmentFilters,
  INBOUND_SHIPMENT_FILTER_PARAMS,
  type InboundShipmentFilters,
  inboundShipmentFilterGroups,
  inboundShipmentFilterInput,
} from '@/lib/inbound-shipment-list-filters'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ShipmentsResult = Awaited<ReturnType<typeof api.inboundShipments.list>>

/** First page rendered on the server so the table never paints empty. */
export type InboundShipmentsInitial = {
  query: ListQuery<InboundShipmentStatus>
  result: ShipmentsResult
  allCount: number
}

const ROWS = siteConfig.ui.rowsPerPage.default
const CREATE_HREF = routes.stock.newInboundShipment()

type Query = InboundShipmentFilters & {
  page: number
  perPage: number
  query: string
  status: InboundShipmentStatus | null
}

function listInput(q: Query) {
  return {
    page: q.page,
    perPage: q.perPage,
    search: q.query || undefined,
    status: q.status ?? undefined,
    ...inboundShipmentFilterInput(q),
  }
}

function InboundShipmentsContent({ initial }: { initial: InboundShipmentsInitial }) {
  // Hooks
  const copy = useCopy(inboundShipmentsContent)
  const panelCopy = useCopy(filterPanelContent)
  const form = useCopy(inboundShipmentFormContent)
  usePrimaryAction(CREATE_HREF)
  const [state, setState] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(ROWS),
      status: parseAsStringLiteral(INBOUND_SHIPMENT_STATUSES),
      ...INBOUND_SHIPMENT_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.result)
  const [loading, setLoading] = useState(false)
  const [delivering, setDelivering] = useState<string | null>(null)

  const hydrated = useRef(false)

  useEffect(() => {
    // The server's first page is used once; after any change (including back to the first
    // tab) the list is fetched again, so it never keeps another tab's rows.
    const firstRun = !hydrated.current
    hydrated.current = true
    if (
      firstRun &&
      sameListQuery(state, initial.query) &&
      state.perPage === ROWS &&
      !hasInboundShipmentFilters(state)
    )
      return
    let stale = false
    setLoading(true)
    api.inboundShipments
      .list(listInput(state))
      .then((next) => !stale && setResult(next))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [state, initial.query])

  // Helpers
  const refresh = async () => {
    setResult(await api.inboundShipments.list(listInput(state)))
  }

  // Render logic
  const groups = inboundShipmentFilterGroups(state, copy.filters, copy.status, panelCopy, (patch) =>
    setState({ ...patch, page: 1 }),
  )
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || state.query.length > 0
  const createButton = (
    <Button render={<Link href={CREATE_HREF} />} nativeButton={false}>
      <Plus />
      {copy.create}
    </Button>
  )

  return (
    <ProoflyListPage title={copy.heading} summary={copy.summary} actions={createButton}>
      <ResourceTable
        resourceName={copy.resource}
        columns={inboundShipmentColumns(copy)}
        items={result.rows}
        getId={(r) => r.id}
        href={(r) => routes.stock.inboundShipment(r.id)}
        rowActions={(r) => (
          <DeleteRowMenu
            label={form.delete}
            confirm={form.confirmDelete}
            deleted={form.deleted}
            failed={form.deleteFailed}
            onDelete={() => api.inboundShipments.delete({ id: r.id })}
            onChanged={() => void refresh()}
            before={
              r.status === 'delivered'
                ? []
                : [
                    {
                      label: form.deliver.action,
                      icon: PackageCheck,
                      onSelect: () => setDelivering(r.id),
                    },
                  ]
            }
          />
        )}
        loading={loading}
        bulkActions={(ids, clear) => (
          <ShipmentBulkActions
            ids={ids}
            onDone={() => {
              clear()
              void refresh()
            }}
          />
        )}
        query={state.query}
        onQueryChange={(query) => setState({ query, page: 1 })}
        onClearAll={() =>
          setState({ ...CLEAR_INBOUND_SHIPMENT_FILTERS, query: '', status: null, page: 1 })
        }
        filterGroups={groups}
        views={
          <ViewSelect
            value={state.status}
            onChange={(status) => setState({ status, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: initial.allCount },
              ...INBOUND_SHIPMENT_STATUSES.map((s) => ({ value: s, label: copy.status[s] })),
            ]}
          />
        }
        page={state.page}
        perPage={state.perPage}
        onPerPageChange={(perPage) => setState({ perPage, page: 1 })}
        total={result.total}
        onPageChange={(page) => setState({ page })}
        empty={
          filtered
            ? copy.noResults
            : { heading: copy.empty.heading, body: copy.empty.body, action: createButton }
        }
      />
      <MarkDeliveredDialog
        shipmentId={delivering}
        onClose={() => setDelivering(null)}
        onDone={() => void refresh()}
      />
    </ProoflyListPage>
  )
}

export default function InboundShipmentsPage({ initial }: { initial: InboundShipmentsInitial }) {
  return (
    <Suspense>
      <InboundShipmentsContent initial={initial} />
    </Suspense>
  )
}
