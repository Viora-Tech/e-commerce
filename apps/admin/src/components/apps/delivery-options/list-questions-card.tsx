'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import DataCard from '@/components/layout/data-card'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { useCopy } from '@/hooks/use-copy'
import DeliveryQuestions from './delivery-questions'
import ListMoreFields from './list-more-fields'
import MoreSettings from './more-settings'
import { fasterOf, listMoreChanged, withFaster, withRounding } from './option-answers'

type ListQuestionsCardProps = {
  /** The option the courier list prices from: the first one shown. */
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
}

/**
 * The courier list's settings as the 3 questions the owner chose (21 Nov 2026, replacing the
 * "What the price includes" sections): who pays, whether shoppers can pick a faster courier,
 * and rounding, with the live example; everything else in one collapsed "More settings".
 */
export default function ListQuestionsCard({ option, onChange }: ListQuestionsCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionQuestionsContent)

  // Event handlers
  const handleRounding = (rounding: DeliveryOption['price']['rounding']) => {
    // The list's "+₹…9" switch follows the rounding, as a list option's always did.
    const listed = withRounding(
      { ...option, couriers: { ...option.couriers, show: 'list' } },
      rounding,
    )
    onChange({ ...listed, couriers: { ...listed.couriers, show: option.couriers.show } })
  }

  // Render logic
  // The automatic courier list always offers every courier, whatever `couriers.show` says.
  const example = { ...option, couriers: { ...option.couriers, show: 'list' as const } }

  return (
    <DataCard title={copy.title} bodyClassName="flex flex-col gap-5">
      <DeliveryQuestions
        idPrefix="courier-list"
        example={example}
        whoPays={option.price.source}
        onWhoPays={(source) => onChange({ ...option, price: { ...option.price, source } })}
        askFaster
        faster={fasterOf(option.couriers)}
        onFaster={(answer) =>
          onChange({ ...option, couriers: withFaster(option.couriers, answer) })
        }
        rounding={option.price.rounding}
        onRounding={handleRounding}
      />
      <MoreSettings hint={copy.more.hintList} changed={listMoreChanged(option).length}>
        <ListMoreFields option={option} onChange={onChange} />
      </MoreSettings>
    </DataCard>
  )
}
