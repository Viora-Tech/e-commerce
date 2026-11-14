'use client'

import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import RecordCombobox from '@/components/pickers/record-combobox'
import StatusLabel from '@/components/status/status-label'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ShipmentOrdersCardProps = {
  shipmentId: string
  orders: Awaited<ReturnType<typeof api.inboundShipments.get>>['orders']
  onChanged: () => void
}

type Hit = Awaited<ReturnType<typeof api.purchaseOrders.list>>['rows'][number]

/** The purchase orders that came in this shipment; adding or removing one recosts them all. */
export default function ShipmentOrdersCard({
  shipmentId,
  orders,
  onChanged,
}: ShipmentOrdersCardProps) {
  // Hooks
  const { orders: copy } = useCopy(inboundShipmentFormContent)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (search.trim() === '') {
      setResults([])
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      api.purchaseOrders
        .list({ search, perPage: 8 })
        .then((r) => !stale && setResults(r.rows))
        .catch(() => !stale && setResults([]))
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [search])

  // Helpers
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleAdd = (purchaseOrderId: string) => {
    setSearch('')
    setResults([])
    return run(() => api.inboundShipments.attach({ id: shipmentId, purchaseOrderId }), copy.added)
  }

  const handleRemove = (purchaseOrderId: string) =>
    run(() => api.inboundShipments.detach({ purchaseOrderId }), copy.removed)

  // Render logic
  const onIt = new Set(orders.map((o) => o.id))
  const addable = results.filter((r) => !onIt.has(r.id) && r.status !== 'cancelled')

  return (
    <Card size="form" gap="none" inset="y-none">
      <CardHeader className="py-5">
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <RecordCombobox
          placeholder={copy.search}
          disabled={busy}
          query={search}
          onQueryChange={setSearch}
          items={addable}
          itemKey={(r) => r.id}
          onPick={(r) => handleAdd(r.id)}
          renderItem={(r) => (
            <>
              <span className="text-body-strong">{copy.number(r.number)}</span>
              <span className="min-w-0 flex-1 truncate text-body">{r.supplierName}</span>
              {r.inboundShipmentId ? (
                <span className="text-caption text-muted-foreground">{copy.elsewhere}</span>
              ) : null}
              <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        />
      </CardContent>
      {orders.length === 0 ? (
        <EmptyState
          variant="plain"
          size="md"
          className="border-line border-t px-5"
          body={copy.empty}
        />
      ) : (
        <ul className="flex flex-col border-line border-t">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 border-line border-b px-5 py-3 last:border-b-0"
            >
              <Link
                href={routes.stock.purchaseOrder(o.id)}
                className="text-body-strong hover:underline"
              >
                {copy.number(o.number)}
              </Link>
              <span className="min-w-0 flex-1 truncate text-body">{o.supplierName}</span>
              <span className="text-caption text-muted-foreground tabular-nums">
                {copy.units(o.units)}
              </span>
              <StatusLabel kind="purchaseOrder" value={o.status} />
              <Button
                variant="outline"
                size="icon"
                aria-label={copy.remove}
                title={copy.remove}
                disabled={busy}
                onClick={() => handleRemove(o.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
