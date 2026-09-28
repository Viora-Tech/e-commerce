'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import CreateReturnDialog from '@/components/returns/create-return-dialog'
import StatusLabel from '@/components/status/status-label'
import { orderReturnsContent, returnsContent } from '@/data/returns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type State = Awaited<ReturnType<typeof api.returns.forOrder>>

type OrderReturnsCardProps = {
  orderId: string
  /** Imported orders are a record: no new returns. */
  readOnly: boolean
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
export default function OrderReturnsCard({ orderId, readOnly, onChanged }: OrderReturnsCardProps) {
  // Hooks
  const copy = useCopy(orderReturnsContent)
  const fmt = useFormat()
  const returnsCopy = useCopy(returnsContent)
  const [state, setState] = useState<State | null>(null)
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey only re-runs the fetch after a return is created.
    if (reloadKey < 0) return
    let live = true
    api.returns.forOrder({ orderId }).then((s) => {
      if (live) setState(s)
    })
    return () => {
      live = false
    }
  }, [orderId, reloadKey])

  // Event handlers
  const handleCreated = () => {
    setCreating(false)
    setReloadKey((k) => k + 1)
    onChanged()
  }

  // Early returns
  if (!state) return null

  // Render logic
  const openRto = state.returns.filter((r) => r.kind === 'rto' && r.status === 'received')
  const canCreate = !readOnly && state.eligibility.lines.some((l) => l.returnable > 0)

  return (
    <DataCard
      title={copy.title}
      action={
        canCreate ? (
          <Button variant="outline" onClick={() => setCreating(true)}>
            {copy.create}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {openRto.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2"
          >
            <span className="flex items-start gap-2 text-body text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{copy.rtoBanner}</span> {copy.rtoHint}
              </span>
            </span>
            <Button
              size="sm"
              render={<Link href={`/orders/returns/${r.id}`} />}
              nativeButton={false}
            >
              {copy.open}
            </Button>
          </div>
        ))}
        {state.returns.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.none}</p>
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
