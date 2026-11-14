'use client'

import { PackageCheck, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'
import TrackingFields, {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from './tracking-fields'

type UnfulfilledCardProps = {
  order: OrderDetail
  /** The card is open for fulfilling (its own button, or the next-step bar's). */
  fulfilling: boolean
  /** Undefined while fulfilment is on hold (#1011): no Fulfil items until it is released. */
  onFulfil?: (() => void) | undefined
  onCancel: () => void
  onDone: () => void
}

/**
 * What is still waiting to be packed. "Fulfil items" opens the card in place, like Shopify's:
 * tick the lines going out (all ticked to start), set how many of each, add tracking, choose
 * whether the shopper hears about it, then Mark as fulfilled. No dialog over the order.
 */
export default function UnfulfilledCard({
  order,
  fulfilling,
  onFulfil,
  onCancel,
  onDone,
}: UnfulfilledCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [unticked, setUnticked] = useState<Record<string, true>>({})
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  // Helpers
  const quantityFor = (lineId: string, remaining: number) =>
    unticked[lineId] ? 0 : (picks[lineId] ?? remaining)
  const reset = () => {
    setPicks({})
    setUnticked({})
    setTracking(EMPTY_TRACKING)
    setNotify(true)
  }

  // Event handlers
  const handleQuantity = (lineId: string, value: string, remaining: number) => {
    const n = Number.parseInt(value, 10)
    const safe = Number.isFinite(n) ? Math.min(Math.max(n, 0), remaining) : 0
    setPicks((p) => ({ ...p, [lineId]: safe }))
    setUnticked(({ [lineId]: _, ...rest }) => rest)
  }

  const handleTick = (lineId: string, on: boolean) =>
    setUnticked(({ [lineId]: _, ...rest }) => (on ? rest : { ...rest, [lineId]: true }))

  const handleTickAll = (on: boolean) =>
    setUnticked(
      on ? {} : Object.fromEntries(unfulfilledLines(order).map((r) => [r.line.id, true as const])),
    )

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleConfirm = async () => {
    const lines = unfulfilledLines(order)
      .map(({ line, remaining }) => ({
        lineId: line.id,
        quantity: quantityFor(line.id, remaining),
      }))
      .filter((l) => l.quantity > 0)
    if (lines.length === 0) return
    setBusy(true)
    try {
      await api.orders.fulfil({
        orderId: order.id,
        lines,
        ...trackingPayload(tracking),
        notifyCustomer: notify,
      })
      toast.success(copy.fulfilDialog.done)
      reset()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.fulfilDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const rows = unfulfilledLines(order)
  const count = rows.reduce((n, r) => n + r.remaining, 0)
  const selected = rows.reduce((n, r) => n + quantityFor(r.line.id, r.remaining), 0)
  const tickedLines = rows.filter((r) => quantityFor(r.line.id, r.remaining) > 0).length
  const allTicked = tickedLines === rows.length

  // Early returns
  if (rows.length === 0 || order.status === 'cancelled') return null

  if (!fulfilling) {
    return (
      <DataCard
        flush
        title={copy.unfulfilled.heading}
        icon={<StatusChip tone="attention">{copy.unfulfilled.itemsCount(count)}</StatusChip>}
        action={
          onFulfil ? (
            <Button variant="ghost" size="sm" onClick={onFulfil}>
              <PackageCheck aria-hidden="true" />
              {copy.actions.fulfilItems}
            </Button>
          ) : undefined
        }
      >
        <OrderLinesTable
          rows={rows.map(({ line, remaining }) => ({ line, quantity: remaining }))}
        />
      </DataCard>
    )
  }

  return (
    <DataCard
      id="fulfil-items"
      title={copy.unfulfilled.heading}
      icon={<StatusChip tone="attention">{copy.unfulfilled.itemsCount(count)}</StatusChip>}
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button variant="outline" onClick={handleCancel} disabled={busy}>
            {copy.fulfilDialog.cancel}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.orders.packingSlips([order.id])} target="_blank" />}
          >
            <Printer aria-hidden="true" />
            {copy.actions.print}
          </Button>
          <Button
            loading={busy}
            onClick={() => void handleConfirm()}
            disabled={busy || selected === 0}
          >
            <PackageCheck aria-hidden="true" />
            {copy.fulfilDialog.confirmShort}
          </Button>
        </>
      }
    >
      <div className="flex flex-col overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-3 border-border border-b px-3 py-2.5">
          <Checkbox
            id="fulfil-select-all"
            checked={allTicked}
            indeterminate={tickedLines > 0 && !allTicked}
            aria-label={copy.fulfilDialog.selectAll}
            onCheckedChange={(v) => handleTickAll(v === true)}
          />
          <label htmlFor="fulfil-select-all" className="text-body font-medium">
            {copy.fulfilDialog.selected(selected)}
          </label>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {rows.map(({ line, remaining }) => {
            const qty = quantityFor(line.id, remaining)
            const title = line.title ?? ''
            const variant =
              line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : null
            return (
              <li
                key={line.id}
                className={
                  qty > 0
                    ? 'flex items-center gap-3 bg-muted/40 px-3 py-2.5'
                    : 'flex items-center gap-3 px-3 py-2.5'
                }
              >
                <Checkbox
                  checked={qty > 0}
                  aria-label={copy.fulfilDialog.pickLine(title)}
                  onCheckedChange={(v) => handleTick(line.id, v === true)}
                />
                <ProductThumb url={line.imageUrl} alt={title} className="size-10" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-strong text-foreground">{title}</span>
                  {variant ? (
                    <span className="truncate text-caption text-muted-foreground">{variant}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5 text-caption text-muted-foreground tabular-nums">
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    aria-label={copy.fulfilDialog.quantity}
                    className="h-8 w-16 tabular-nums"
                    value={qty}
                    onChange={(e) => handleQuantity(line.id, e.target.value, remaining)}
                  />
                  {copy.fulfilDialog.ofQuantity(remaining)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <TrackingFields value={tracking} onChange={setTracking} />

      <div className="flex items-start gap-3">
        <Switch id="fulfil-notify" checked={notify} onCheckedChange={setNotify} />
        <span className="flex flex-col">
          <label htmlFor="fulfil-notify" className="text-body font-medium text-foreground">
            {copy.fulfilDialog.notify}
          </label>
          <span className="text-caption text-muted-foreground">{copy.fulfilDialog.notifyHint}</span>
        </span>
      </div>
    </DataCard>
  )
}
