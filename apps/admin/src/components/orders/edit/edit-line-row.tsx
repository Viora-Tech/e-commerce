'use client'

import { RotateCcw, Tag, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import LineItemRow from '@/components/layout/line-item-row'
import StatusChip from '@/components/layout/status-chip'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import type { OrderLine } from '../order-detail-types'
import { lineName } from './edit-state'

type EditLineRowProps = {
  line: OrderLine
  /** The line as the edit has it. */
  quantity: number
  unitPricePaise: number
  restock: boolean
  onQuantity: (quantity: number) => void
  onPrice: (unitPricePaise: number) => void
  onRestock: (restock: boolean) => void
  /** Opens "Add discount" for this line. */
  onDiscount: () => void
}

const toCount = (value: string, min: number) => Math.max(min, Number.parseInt(value, 10) || min)

/**
 * One line already on the order (#1014): quantity and price while unpacked, never below what was
 * packed (and a packed line keeps its price, saying why), remove and undo, a line discount, and
 * "Restock" under a line the edit takes units off.
 */
export default function EditLineRow({
  line,
  quantity,
  unitPricePaise,
  restock,
  onQuantity,
  onPrice,
  onRestock,
  onDiscount,
}: EditLineRowProps) {
  // Hooks
  const copy = useCopy(orderEditContent)

  // Render logic
  const removed = quantity === 0
  const packed = line.fulfilledQuantity
  const locked = line.giftCard || packed > 0
  const takenOff = line.quantity - quantity
  const restockId = `edit-restock-${line.id}`

  return (
    <LineItemRow
      imageUrl={line.imageUrl}
      title={lineName(line.title, line.variantTitle)}
      className={cn(removed && 'opacity-60')}
      subtitle={
        takenOff > 0 && !line.giftCard ? (
          <Label htmlFor={restockId} className="inline-flex items-center gap-1.5 font-normal">
            <Checkbox id={restockId} checked={restock} onCheckedChange={(on) => onRestock(on)} />
            {copy.restock(takenOff)}
          </Label>
        ) : line.giftCard ? (
          copy.giftCard
        ) : packed > 0 ? (
          copy.packed(packed)
        ) : (
          `${formatPaise(line.unitPricePaise)} × ${line.quantity}`
        )
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
              disabled={line.giftCard}
              onChange={(e) => onQuantity(toCount(e.target.value, Math.max(1, packed)))}
              className="w-20 text-right tabular-nums"
            />
            {line.giftCard ? null : (
              <DraftMoneyInput
                aria-label={copy.price}
                valuePaise={unitPricePaise}
                disabled={packed > 0}
                onChangePaise={onPrice}
                className="w-28 text-right tabular-nums"
              />
            )}
            {locked ? (
              <span className="size-9" />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.lineDiscount.action}
                title={copy.lineDiscount.action}
                onClick={onDiscount}
              >
                <Tag />
              </Button>
            )}
          </>
        )
      }
      amount={formatPaise(quantity * unitPricePaise)}
      aside={
        locked ? (
          <span className="size-9" />
        ) : removed ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.restore}
            title={copy.restore}
            onClick={() => onQuantity(line.quantity)}
          >
            <RotateCcw />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.remove}
            title={copy.remove}
            onClick={() => onQuantity(0)}
          >
            <X />
          </Button>
        )
      }
    />
  )
}
