'use client'

import { PRICE_ROUNDINGS, type PriceRounding } from '@commerce/core/delivery-options'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'

type RoundingSegmentsProps = {
  /** The id of the visible question that names the choice. */
  labelledBy: string
  value: PriceRounding
  onChange: (next: PriceRounding) => void
}

/** "Round prices to ₹…9 / ₹…49/…99 / ₹10 / Off" (`price.rounding`) as one segmented choice,
 *  with what the chosen one does under it ("₹43 → ₹49, ₹58 → ₹59"). */
export default function RoundingSegments({ labelledBy, value, onChange }: RoundingSegmentsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionQuestionsContent)
  const pages = useCopy(deliveryPagesContent)

  // Event handlers
  const handleChange = (next: string[]) => {
    const picked = PRICE_ROUNDINGS.find((r) => r === next[0])
    if (picked) onChange(picked)
  }

  // Render logic
  return (
    <div className="flex flex-col gap-1.5">
      <ToggleGroup
        variant="segmented"
        aria-labelledby={labelledBy}
        value={[value]}
        onValueChange={handleChange}
        className="w-full max-w-full flex-wrap sm:w-fit"
      >
        {PRICE_ROUNDINGS.map((r) => (
          <ToggleGroupItem key={r} value={r} className="flex-1 tabular-nums sm:flex-none">
            {copy.round.items[r]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-caption text-muted-foreground">{pages.courierList.roundItems[value]}</p>
    </div>
  )
}
