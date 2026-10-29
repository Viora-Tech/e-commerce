'use client'

import { RotateCcw, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
import StatusChip from '@/components/layout/status-chip'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import type { OrderDetail } from '../order-detail-types'
import EditAddSearch from './edit-add-search'
import { type EditState, lineName, priceOf, quantityOf, type VariantResult } from './edit-state'

type EditLinesCardProps = {
  order: OrderDetail
  state: EditState
  onChange: (patch: Partial<EditState>) => void
}

const toCount = (value: string, min: number) => Math.max(min, Number.parseInt(value, 10) || min)

/** The order's items as they would be: change quantities and prices, remove, undo, and add new ones. */
export default function EditLinesCard({ order, state, onChange }: EditLinesCardProps) {
  // Hooks
  const copy = useCopy(orderEditContent)

  // Event handlers
  const handleQuantity = (lineId: string, quantity: number) => {
    onChange({ quantities: { ...state.quantities, [lineId]: quantity } })
  }

  const handlePrice = (lineId: string, unitPricePaise: number) => {
    onChange({ prices: { ...state.prices, [lineId]: unitPricePaise } })
  }

  const handleAdd = (v: VariantResult) => {
    const existing = state.added.find((a) => a.variantId === v.variantId)
    onChange({
      added: existing
        ? state.added.map((a) =>
            a.variantId === v.variantId ? { ...a, quantity: a.quantity + 1 } : a,
          )
        : [
            ...state.added,
            {
              variantId: v.variantId,
              title: v.title,
              variantTitle: v.variantTitle,
              sku: v.sku,
              imageUrl: v.imageUrl,
              quantity: 1,
              unitPricePaise: v.pricePaise,
            },
          ],
    })
  }

  const handleAddedChange = (
    variantId: string,
    patch: { quantity?: number; unitPricePaise?: number },
  ) => {
    onChange({
      added: state.added.map((a) => (a.variantId === variantId ? { ...a, ...patch } : a)),
    })
  }

  const handleAddedRemove = (variantId: string) => {
    onChange({ added: state.added.filter((a) => a.variantId !== variantId) })
  }

  // Render logic
  return (
    <DataCard title={copy.items} bodyClassName="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line">
        {order.lines.map((l) => {
          const quantity = quantityOf(state, l)
          const price = priceOf(state, l)
          const removed = quantity === 0
          const packed = l.fulfilledQuantity
          return (
            <LineItemRow
              key={l.id}
              imageUrl={l.imageUrl}
              title={lineName(l.title, l.variantTitle)}
              className={cn(removed && 'opacity-60')}
              subtitle={
                l.giftCard
                  ? copy.giftCard
                  : packed > 0
                    ? copy.packed(packed)
                    : `${formatPaise(l.unitPricePaise)} × ${l.quantity}`
              }
              controls={
                removed ? (
                  <StatusChip tone="neutral">{copy.removed}</StatusChip>
                ) : (
                  <>
                    <Input
                      aria-label={copy.quantity}
                      type="number"
                      min={Math.max(1, packed)}
                      value={quantity}
                      disabled={l.giftCard}
                      onChange={(e) =>
                        handleQuantity(l.id, toCount(e.target.value, Math.max(1, packed)))
                      }
                      className="w-20 text-right tabular-nums"
                    />
                    {l.giftCard ? null : (
                      <DraftMoneyInput
                        aria-label={copy.price}
                        valuePaise={price}
                        onChangePaise={(paise) => handlePrice(l.id, paise)}
                        className="w-28 text-right tabular-nums"
                      />
                    )}
                  </>
                )
              }
              amount={formatPaise(quantity * price)}
              aside={
                l.giftCard || packed > 0 ? (
                  <span className="size-9" />
                ) : removed ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.restore}
                    title={copy.restore}
                    onClick={() => handleQuantity(l.id, l.quantity)}
                  >
                    <RotateCcw />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.remove}
                    title={copy.remove}
                    onClick={() => handleQuantity(l.id, 0)}
                  >
                    <X />
                  </Button>
                )
              }
            />
          )
        })}
        {state.added.map((a) => (
          <LineItemRow
            key={a.variantId}
            imageUrl={a.imageUrl}
            title={lineName(a.title, a.variantTitle)}
            subtitle={<StatusChip tone="info">{copy.added}</StatusChip>}
            controls={
              <>
                <Input
                  aria-label={copy.quantity}
                  type="number"
                  min={1}
                  value={a.quantity}
                  onChange={(e) =>
                    handleAddedChange(a.variantId, { quantity: toCount(e.target.value, 1) })
                  }
                  className="w-20 text-right tabular-nums"
                />
                <DraftMoneyInput
                  aria-label={copy.price}
                  valuePaise={a.unitPricePaise}
                  onChangePaise={(paise) =>
                    handleAddedChange(a.variantId, { unitPricePaise: paise })
                  }
                  className="w-28 text-right tabular-nums"
                />
              </>
            }
            amount={formatPaise(a.quantity * a.unitPricePaise)}
            aside={
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.remove}
                title={copy.remove}
                onClick={() => handleAddedRemove(a.variantId)}
              >
                <X />
              </Button>
            }
          />
        ))}
      </ul>
      <EditAddSearch onAdd={handleAdd} />
    </DataCard>
  )
}
