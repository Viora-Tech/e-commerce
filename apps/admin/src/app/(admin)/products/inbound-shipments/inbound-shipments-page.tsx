'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { inboundShipmentColumns } from '@/components/inbound-shipments/shipment-columns'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  inboundShipmentsContent,
} from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
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
const CREATE_HREF = routes.products.newInboundShipment()

function InboundShipmentsContent({ initial }: { initial: InboundShipmentsInitial }) {
  // Hooks
  const copy = useCopy(inboundShipmentsContent)
  usePrimaryAction(CREATE_HREF)
  const [state, setState] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(ROWS),
      status: parseAsStringLiteral(INBOUND_SHIPMENT_STATUSES),
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.result)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameListQuery(state, initial.query) && state.perPage === ROWS) return
    let stale = false
    setLoading(true)
    api.inboundShipments
      .list({
        page: state.page,
        perPage: state.perPage,
        search: state.query || undefined,
        status: state.status ?? undefined,
      })
      .then((next) => !stale && setResult(next))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [state, initial.query])

  // Render logic
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
        href={(r) => routes.products.inboundShipment(r.id)}
        loading={loading}
        selectable={false}
        query={state.query}
        onQueryChange={(query) => setState({ query, page: 1 })}
        onClearAll={() => setState({ query: '', status: null, page: 1 })}
        tabs={
          <PillTabs
            variant="segmented"
            value={state.status}
            onChange={(status) => setState({ status, page: 1 })}
            tabs={[
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
        empty={{ heading: copy.empty.heading, body: copy.empty.body, action: createButton }}
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
