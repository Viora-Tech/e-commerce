'use client'

import { Minus, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'

type ItemStepperProps = {
  /** The item's name, for the buttons' labels ("One less Glasspad"). */
  title: string
  /** How many go now. */
  value: number
  /** What the line still has to send. */
  max: number
  onChange: (next: number) => void
}

/** "− 1 of 2 +": how many of one item ship now, from none up to what it still has to send.
 *  Shared by the order page's partial shipment and the bulk drawer's Edit shipment. */
export default function ItemStepper({ title, value, max, onChange }: ItemStepperProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.partial)

  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md border border-border p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={copy.less(title)}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span className="w-12 text-center text-body tabular-nums">{copy.of(value, max)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={copy.more(title)}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </span>
  )
}
