'use client'

import { Plus, TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import EmptyState from '@/components/layout/empty-state'
import CreateReturnDialog from '@/components/returns/create-return-dialog'
import StatusLabel from '@/components/status/status-label'
import { orderReturnsContent, returnsContent } from '@/data/returns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type State = Awaited<ReturnType<typeof api.returns.forOrder>>

type OrderReturnsCardProps = {
  orderId: string
  /** Imported orders are a record: no new returns. */
  readOnly: boolean
  /**
   * The card will most likely show (a shipped order can be returned): hold its place with a
   * skeleton while it loads instead of popping in. An unshipped order draws nothing meanwhile,
   * since its card usually stays hidden.
   */
  expected?: boolean
  onChanged: () => void
}

/** One line about the return window, in the shop owner's words. */
function windowLine(
  copy: typeof orderReturnsContent,
  fmt: Formatters,
  s: NonNullable<State>,
): string {
  const e = s.eligibility
  if (e.why === 'disabled') return copy.disabled
  if (!e.closesAt) return copy.notDelivered
  return e.why === 'window_closed'
    ? copy.windowClosed(fmt.date(e.closesAt))
    : copy.windowOpen(fmt.date(e.closesAt))
}

/** The order page's Returns card: an RTO task banner first, then every return on the order. */
export default function OrderReturnsCard({
  orderId,
  readOnly,
  expected = false,
  onChanged,
}: OrderReturnsCardProps) {
  // Hooks
  const copy = useCopy(orderReturnsContent)
  const fmt = useFormat()
  const returnsCopy = useCopy(returnsContent)
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // A failed read hides the card, as one with nothing to show.
  const { data: state, failed: hidden } = useLoad(
    () => api.returns.forOrder({ orderId }),
    [orderId, reloadKey],
  )

  // Event handlers
  const handleCreated = () => {
    setCreating(false)
    setReloadKey((k) => k + 1)
    onChanged()
  }

  // Early returns
  if (!state) return expected && !hidden ? <DataCardSkeleton fields={1} lines={1} /> : null

  // Render logic
  const openRto = state.returns.filter((r) => r.kind === 'rto' && r.status === 'received')
  const canCreate = !readOnly && state.eligibility.lines.some((l) => l.returnable > 0)

  // No returns and none can be made (unshipped, imported): no empty card (audit #12).
  if (state.returns.length === 0 && !canCreate) return null

  return (
    <DataCard
      title={copy.title}
      action={
        canCreate ? (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            {copy.create}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {openRto.map((r) => (
          <Alert
            key={r.id}
            tone="danger"
            action={
              <Button
                size="sm"
                render={<Link href={`/orders/returns/${r.id}`} />}
                nativeButton={false}
              >
                {copy.open}
              </Button>
            }
          >
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{copy.rtoBanner}</AlertTitle>
            <AlertDescription>{copy.rtoHint}</AlertDescription>
          </Alert>
        ))}
        {state.returns.length === 0 ? (
          <EmptyState variant="inline" body={copy.none} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {state.returns.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/orders/returns/${r.id}`} className="flex flex-col hover:underline">
                  <span className="text-body text-foreground">
                    {r.label} · {returnsCopy.kind[r.kind]}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {returnsCopy.itemCount(r.lines.reduce((n, l) => n + l.returnQuantity, 0))} ·{' '}
                    {fmt.money(r.valuePaise)}
                  </span>
                </Link>
                <StatusLabel
                  kind="return"
                  value={r.status}
                  label={r.kind === 'rto' ? returnsCopy.rtoStatus[r.status] : undefined}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-muted-foreground">{windowLine(copy, fmt, state)}</p>
      </div>
      {canCreate ? (
        <CreateReturnDialog
          orderId={orderId}
          state={state}
          open={creating}
          onClose={() => setCreating(false)}
          onDone={handleCreated}
        />
      ) : null}
    </DataCard>
  )
}
