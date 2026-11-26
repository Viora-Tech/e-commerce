'use client'

import type { ReactNode } from 'react'
import { itemTabs, loadPicked } from '@/components/discounts/pick-sources'
import PickedField from '@/components/pickers/picked-field'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { affiliatesContent } from '@/data/affiliates'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { type TargetKind, tabOf } from './targets'

type TargetPickerProps = {
  kind: TargetKind
  ids: string[]
  onChange: (ids: string[]) => void
  /** A control on each picked row, before the remove button (a percent input). */
  rowExtra?: ((item: PickItem) => ReactNode) | undefined
}

/**
 * Products or collections for an affiliate program, picked through the same Browse dialog the
 * Discounts app uses: names and images on each row, only the ids are saved.
 */
export default function TargetPicker({ kind, ids, onChange, rowExtra }: TargetPickerProps) {
  // Hooks
  const { value: pick } = useCopy(discountFormContent)
  const { settings: copy } = useCopy(affiliatesContent)
  const locale = useLocale()

  // Render logic
  const tab = tabOf(kind)
  const tabs = itemTabs(pick, locale).filter((t) => t.key === tab)

  return (
    <PickedField
      kind={tab}
      ids={ids}
      tabs={tabs}
      title={kind === 'product' ? copy.pickProducts : copy.pickCollections}
      search={kind === 'product' ? pick.productSearch : pick.collectionSearch}
      labels={pick}
      loadPicked={(_, missing) => loadPicked(tab, missing, pick, locale)}
      onChange={(next) => onChange(next.ids)}
      rowExtra={rowExtra}
    />
  )
}
