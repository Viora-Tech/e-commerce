'use client'

import { siteConfig } from '@commerce/config/site'
import { permissions } from '@commerce/core/permissions'
import { Plus, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import type { StoreLocation } from '@/components/inventory/location-select'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import SingleLocation from '@/components/transfers/single-location'
import { transferColumns } from '@/components/transfers/transfer-columns'
import { TRANSFER_STATUSES, type TransferStatus, transfersContent } from '@/data/inventory'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

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
const copy = transfersContent

function TransfersContent({ initial }: { initial: TransfersInitial }) {
  // Hooks
  usePrimaryAction(NEW_HREF)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(PER_PAGE),
      status: parseAsStringLiteral(TRANSFER_STATUSES),
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.result.rows)
  const [total, setTotal] = useState(initial.result.total)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (sameListQuery(q, initial.query) && q.perPage === PER_PAGE) return
    let cancelled = false
    setLoading(true)
    api.transfers
      .list({
        page: q.page,
        perPage: q.perPage,
        search: q.query || undefined,
        status: q.status ?? undefined,
      })
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

  // Render logic
  const canWrite = hasPermission(permissions.INVENTORY_WRITE)
  const single = initial.locations.length < 2
  const create = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
            <SquarePlus strokeWidth={1.6} />
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
          loading={loading}
          selectable={false}
          query={q.query}
          onQueryChange={(query) => setQ({ query, page: 1 })}
          onClearAll={() => setQ({ query: '', status: null, page: 1 })}
          tabs={
            <PillTabs
              variant="segmented"
              value={q.status}
              onChange={(status) => setQ({ status, page: 1 })}
              tabs={[
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
          empty={{
            heading: copy.empty.heading,
            body: copy.empty.body,
            action: (
              <Button render={<Link href={NEW_HREF} />} nativeButton={false}>
                <Plus />
                {copy.create}
              </Button>
            ),
          }}
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
