'use client'

import { Tag, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import LineItemRow from '@/components/layout/line-item-row'
import StatusChip from '@/components/layout/status-chip'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'

type EditNewRowProps = {
  title: string
  imageUrl: string | null
  /** A one-off item, not from the catalogue: its chip says so. */
  custom?: boolean
  quantity: number
  unitPricePaise: number
  onChange: (patch: { quantity?: number; unitPricePaise?: number }) => void
  onRemove: () => void
  /** Opens "Add discount" for this line. */
  onDiscount: () => void
}

const toCount = (value: string) => Math.max(1, Number.parseInt(value, 10) || 1)

/** An item the edit adds (from the catalogue or a custom one): quantity, price, discount, remove. */
export default function EditNewRow({
  title,
  imageUrl,
  custom = false,
  quantity,
  unitPricePaise,
  onChange,
  onRemove,
  onDiscount,
}: EditNewRowProps) {
  // Hooks
  const copy = useCopy(orderEditContent)

  return (
    <LineItemRow
      imageUrl={imageUrl}
      title={title}
      subtitle={<StatusChip tone="info">{custom ? copy.custom : copy.added}</StatusChip>}
      controls={
        <>
          <Input
            aria-label={copy.quantity}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => onChange({ quantity: toCount(e.target.value) })}
            className="w-20 text-right tabular-nums"
          />
          <DraftMoneyInput
            aria-label={copy.price}
            valuePaise={unitPricePaise}
            onChangePaise={(paise) => onChange({ unitPricePaise: paise })}
            className="w-28 text-right tabular-nums"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.lineDiscount.action}
            title={copy.lineDiscount.action}
            onClick={onDiscount}
          >
            <Tag />
          </Button>
        </>
      }
      amount={formatPaise(quantity * unitPricePaise)}
      aside={
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.remove}
          title={copy.remove}
          onClick={onRemove}
        >
          <X />
        </Button>
      }
    />
  )
}
