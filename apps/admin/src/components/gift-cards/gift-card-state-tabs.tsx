'use client'

import ViewSelect from '@/components/table/view-select'
import { GIFT_CARD_STATES, type GiftCardStateFilter, giftCardsContent } from '@/data/gift-cards'
import { useCopy } from '@/hooks/use-copy'

type GiftCardStateTabsProps = {
  value: GiftCardStateFilter | null
  allCount: number
  onChange: (s: GiftCardStateFilter | null) => void
}

/** The gift card list's view picker: all cards, or one state. */
export default function GiftCardStateTabs({ value, allCount, onChange }: GiftCardStateTabsProps) {
  // Hooks
  const copy = useCopy(giftCardsContent)

  return (
    <ViewSelect<GiftCardStateFilter | null>
      value={value}
      onChange={onChange}
      options={[
        { value: null, label: copy.tabs.all, count: allCount },
        ...GIFT_CARD_STATES.map((s) => ({ value: s, label: copy.tabs[s] })),
      ]}
    />
  )
}
